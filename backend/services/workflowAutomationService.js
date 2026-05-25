/**
 * Real-time workflow orchestration — event dispatch, deduplication, retries, SLA, schedules.
 */
const { getFirestore } = require('../config/firebaseAdmin')
const { sanitizeFirestoreData } = require('../utils/sanitizeFirestoreData')
const notificationService = require('./notificationService')
const { getStorage } = require('./storageAdapter')
const pushNotificationService = require('./pushNotificationService')

const WORKFLOW_COLLECTION = 'workflowEvents'
const MAX_RETRIES = 3
const SLA_ACCEPT_MINUTES = 15
const SLA_ADMIN_ESCALATION_MINUTES = 60
const MISSED_BRIEFING_HOURS_AFTER = 4
const BRIEFING_REMINDER_HOURS_BEFORE = 2
const TENDER_CLOSING_HOURS = 24

const SUPPORTED_EVENTS = new Set([
  'attendance_requested',
  'request_paid',
  'request_accepted',
  'report_uploaded',
  'tender_closing_soon',
  'briefing_missed',
])

const NOTIFY_MAP = {
  attendance_requested: ['sme_requested_attendance'],
  request_paid: ['payment_confirmed', 'sme_requested_attendance'],
  request_accepted: ['agent_accepted_briefing'],
  report_uploaded: ['briefing_report_submitted', 'attendance_request_completed'],
  tender_closing_soon: ['tender_closing_soon'],
  briefing_missed: ['briefing_missed'],
}

function nowIso() {
  return new Date().toISOString()
}

function workflowEventId(eventType, payload) {
  const entity =
    payload.requestId ||
    payload.id ||
    payload.tenderId ||
    payload.reportId ||
    'global'
  const suffix = payload.idempotencySuffix || ''
  return `wf-${eventType}-${entity}${suffix ? `-${suffix}` : ''}`.replace(/[^a-zA-Z0-9:_-]/g, '_').slice(0, 150)
}

async function getWorkflowDb() {
  return getFirestore()
}

async function findRecentWorkflowEvent(idempotencyKey, withinMs = 10 * 60 * 1000) {
  const db = await getWorkflowDb()
  const ref = db.collection(WORKFLOW_COLLECTION).doc(idempotencyKey)
  const doc = await ref.get()
  if (!doc.exists) return null
  const data = doc.data()
  const started = new Date(data.startedAt || 0).getTime()
  if (Date.now() - started > withinMs) return null
  if (data.status === 'completed') return data
  return data
}

async function saveWorkflowEvent(patch) {
  const db = await getWorkflowDb()
  const id = patch.id || workflowEventId(patch.type, patch.payload || {})
  const ref = db.collection(WORKFLOW_COLLECTION).doc(id)
  const existing = await ref.get()
  const base = existing.exists ? existing.data() : {}
  const doc = sanitizeFirestoreData({
    ...base,
    ...patch,
    id,
    updatedAt: nowIso(),
  })
  await ref.set(doc, { merge: true })
  return doc
}

async function executeEventNotifications(eventType, payload, channels) {
  const notifyTypes = NOTIFY_MAP[eventType] || []
  const results = []
  for (const notifyType of notifyTypes) {
    const r = await notificationService.notify(notifyType, payload)
    results.push({ notifyType, results: r })
  }
  if (channels.includes('push')) {
    const recipients = new Set()
    if (payload.smeId) recipients.add(payload.smeId)
    if (payload.assignedAgentId) recipients.add(payload.assignedAgentId)
    if (Array.isArray(payload.notifiedAgents)) {
      for (const id of payload.notifiedAgents) recipients.add(id)
    }
    const copy = notificationService.notificationCopy
      ? notificationService.notificationCopy(
          NOTIFY_MAP[eventType]?.[0] || eventType,
          payload
        )
      : { title: 'TenderBriefing', message: eventType.replace(/_/g, ' ') }
    for (const userId of recipients) {
      const pr = await pushNotificationService.sendPush({
        userId,
        title: copy.title,
        body: copy.message,
        data: { eventType, requestId: payload.id || payload.requestId },
      })
      results.push({ channel: 'push', userId, ...pr })
    }
  }
  return results
}

async function handleReportUploaded(payload) {
  let pdfMeta = null
  try {
    const briefingReportPdfService = require('./briefingReportPdfService')
    pdfMeta = await briefingReportPdfService.generateAndAttachReportPdf({
      reportId: payload.reportId,
      requestId: payload.requestId || payload.id,
      request: payload,
    })
    if (pdfMeta?.pdfUrl) {
      payload.pdfSummaryUrl = pdfMeta.pdfUrl
    }
  } catch (err) {
    pdfMeta = { error: err instanceof Error ? err.message : 'PDF generation failed' }
  }
  const notificationResults = await executeEventNotifications('report_uploaded', payload, [
    'whatsapp',
    'inbox',
    'push',
  ])
  return { notificationResults, pdfMeta }
}

async function runEventHandler(eventType, payload, channels = ['whatsapp', 'inbox', 'push']) {
  switch (eventType) {
    case 'report_uploaded':
      return handleReportUploaded(payload)
    default:
      return {
        notificationResults: await executeEventNotifications(eventType, payload, channels),
      }
  }
}

/**
 * Central workflow dispatcher.
 */
async function dispatchWorkflowEvent(eventType, payload = {}, options = {}) {
  if (!SUPPORTED_EVENTS.has(eventType)) {
    throw new Error(`Unsupported workflow event: ${eventType}`)
  }

  const idempotencyKey =
    options.idempotencyKey || workflowEventId(eventType, payload)
  const existing = await findRecentWorkflowEvent(idempotencyKey)
  if (existing?.status === 'completed' && !options.force) {
    return { duplicate: true, workflowEvent: existing }
  }

  const startedAt = nowIso()
  await saveWorkflowEvent({
    id: idempotencyKey,
    type: eventType,
    status: 'running',
    payload: sanitizeFirestoreData(payload),
    startedAt,
    completedAt: null,
    retryCount: existing?.retryCount || 0,
    error: null,
    notificationChannels: options.channels || ['whatsapp', 'inbox', 'push'],
    recipients: options.recipients || [],
  })

  try {
    const handlerResult = await runEventHandler(eventType, payload, options.channels)
    const completed = await saveWorkflowEvent({
      id: idempotencyKey,
      type: eventType,
      status: 'completed',
      payload: sanitizeFirestoreData(payload),
      startedAt,
      completedAt: nowIso(),
      retryCount: existing?.retryCount || 0,
      error: null,
      handlerResult: sanitizeFirestoreData({
        pdfAttached: !!handlerResult?.pdfMeta?.pdfUrl,
        notificationCount: handlerResult?.notificationResults?.length || 0,
      }),
    })
    return { success: true, workflowEvent: completed, ...handlerResult }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Workflow failed'
    const retryCount = (existing?.retryCount || 0) + 1
    const failed = await saveWorkflowEvent({
      id: idempotencyKey,
      type: eventType,
      status: retryCount < MAX_RETRIES ? 'retry_pending' : 'failed',
      payload: sanitizeFirestoreData(payload),
      startedAt,
      completedAt: nowIso(),
      retryCount,
      error: errMsg,
    })
    return { success: false, workflowEvent: failed, error: errMsg }
  }
}

function parseDate(value) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

async function runTenderClosingReminders() {
  const storage = getStorage()
  const tenders =
    (typeof storage.getAllTenders === 'function' && (await storage.getAllTenders())) ||
    (typeof storage.getTenders === 'function' && (await storage.getTenders())) ||
    []
  const now = Date.now()
  const windowEnd = now + TENDER_CLOSING_HOURS * 60 * 60 * 1000
  let triggered = 0

  const db = await getWorkflowDb()
  for (const tender of tenders) {
    const closing = parseDate(tender.closingDate || tender.submissionDeadline)
    if (!closing) continue
    const t = closing.getTime()
    if (t <= now || t > windowEnd) continue

    const workspaceSnap = await db.collectionGroup('trackedTenders').get().catch(() => null)
    if (!workspaceSnap) continue

    for (const doc of workspaceSnap.docs) {
      const entry = doc.data()
      if (entry.tenderId !== tender.id && entry.id !== tender.id) continue
      const smeId = doc.ref.parent.parent?.id
      if (!smeId) continue
      await dispatchWorkflowEvent('tender_closing_soon', {
        smeId,
        tenderId: tender.id,
        tenderNumber: tender.tenderNumber || tender.title,
        tenderTitle: tender.title,
        closingDate: closing.toISOString(),
      })
      triggered += 1
    }
  }
  return { job: 'tender_closing_reminders', triggered }
}

async function runBriefingReminders() {
  const storage = getStorage()
  const requests = await storage.getAttendanceRequests()
  const now = Date.now()
  const windowMs = BRIEFING_REMINDER_HOURS_BEFORE * 60 * 60 * 1000
  let triggered = 0

  for (const request of requests) {
    if (request.status !== 'assigned' && request.status !== 'accepted') continue
    const briefingAt = parseDate(request.briefingDate)
    if (!briefingAt) continue
    const delta = briefingAt.getTime() - now
    if (delta < 0 || delta > windowMs) continue

    await notificationService.notify('briefing_date_changed', {
      ...request,
      id: request.id,
      requestId: request.id,
      to: briefingAt.toISOString(),
    })
    triggered += 1
  }
  return { job: 'briefing_reminders', triggered }
}

async function runMissedBriefingDetection() {
  const storage = getStorage()
  const requests = await storage.getAttendanceRequests()
  const now = Date.now()
  const thresholdMs = MISSED_BRIEFING_HOURS_AFTER * 60 * 60 * 1000
  let triggered = 0

  for (const request of requests) {
    if (request.status !== 'assigned') continue
    if (request.briefingMissed === true) continue
    const briefingAt = parseDate(request.briefingDate)
    if (!briefingAt) continue
    if (now - briefingAt.getTime() < thresholdMs) continue

    const updated = {
      ...request,
      briefingMissed: true,
      briefingMissedAt: nowIso(),
      updatedAt: nowIso(),
    }
    await storage.saveAttendanceRequest(updated)
    await dispatchWorkflowEvent('briefing_missed', {
      ...updated,
      id: request.id,
      requestId: request.id,
    })
    triggered += 1
  }
  return { job: 'missed_briefing_detection', triggered }
}

async function retryFailedWhatsApp({ limit = 20 } = {}) {
  const db = await getWorkflowDb()
  const snap = await db
    .collection('notifications')
    .where('channel', '==', 'whatsapp')
    .limit(200)
    .get()

  const candidates = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((n) => n.status === 'failed' || n.status === 'pending')
    .filter((n) => n.type !== 'idempotency_marker')
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, limit)

  const whatsappService = require('./whatsappService')
  let retried = 0
  let sent = 0

  for (const row of candidates) {
    if (!row.message || !row.to) continue
    const result = await whatsappService.sendWhatsAppMessage(row.to, row.message, {
      type: row.type || 'retry',
      recipientRole: row.recipientRole,
      recipientId: row.recipientId,
      metadata: { ...(row.metadata || {}), retryOf: row.id },
      idempotencyKey: `retry:${row.id}:${Date.now()}`,
    })
    retried += 1
    if (result.ok) sent += 1
  }

  return { job: 'retry_failed_whatsapp', retried, sent }
}

async function loadAgentsForMatching() {
  try {
    const db = await getWorkflowDb()
    const snap = await db.collection('agents').limit(500).get()
    return snap.docs.map((d) => ({ id: d.id, ...d.data(), userType: 'youth-agent' }))
  } catch {
    return []
  }
}

function findNearbyAgentsSimple(agents, request) {
  const DEFAULT_RADIUS_KM = 50
  const score = (a) => (a.rating || 3) + (a.province === request.province ? 2 : 0)
  return agents
    .filter((a) => (a.missedMeetings || 0) < 2)
    .filter((a) => !request.province || a.province === request.province)
    .map((a) => ({ ...a, matchScore: score(a) }))
    .sort((a, b) => b.matchScore - a.matchScore)
}

async function runSlaEscalations() {
  const storage = getStorage()
  const requests = await storage.getAttendanceRequests()
  const agents = await loadAgentsForMatching()
  const now = Date.now()
  let agentEscalations = 0
  let adminEscalations = 0

  for (const request of requests) {
    if (request.status !== 'pending') continue
    if (request.paymentStatus !== 'paid') continue
    const paidAt = parseDate(request.paidAt || request.updatedAt)
    if (!paidAt) continue
    const minutesWaiting = (now - paidAt.getTime()) / (60 * 1000)

    if (minutesWaiting >= SLA_ADMIN_ESCALATION_MINUTES && !request.slaAdminEscalatedAt) {
      request.slaAdminEscalatedAt = nowIso()
      await storage.saveAttendanceRequest(request)
      await dispatchWorkflowEvent('attendance_requested', {
        ...request,
        id: request.id,
        requestId: request.id,
        slaEscalation: 'admin_60m',
      })
      adminEscalations += 1
      continue
    }

    if (minutesWaiting >= SLA_ACCEPT_MINUTES && !request.slaAgentEscalatedAt) {
      const nearby = findNearbyAgentsSimple(agents, request)
      const extraAgents = nearby
        .map((a) => a.id)
        .filter((id) => !request.notifiedAgents?.includes(id))
        .slice(0, 5)
      if (extraAgents.length) {
        request.notifiedAgents = [...(request.notifiedAgents || []), ...extraAgents]
      }
      request.slaAgentEscalatedAt = nowIso()
      await storage.saveAttendanceRequest(request)
      await dispatchWorkflowEvent('attendance_requested', {
        ...request,
        id: request.id,
        requestId: request.id,
        slaEscalation: 'agents_15m',
      })
      agentEscalations += 1
    }
  }

  return {
    job: 'sla_escalations',
    agentEscalations,
    adminEscalations,
  }
}

async function runScheduledAutomation(jobName = 'all') {
  const results = {}
  const jobs =
    jobName === 'all'
      ? [
          'tender_closing_reminders',
          'briefing_reminders',
          'missed_briefing_detection',
          'retry_failed_whatsapp',
          'sla_escalations',
        ]
      : [jobName]

  for (const job of jobs) {
    switch (job) {
      case 'tender_closing_reminders':
        results[job] = await runTenderClosingReminders()
        break
      case 'briefing_reminders':
        results[job] = await runBriefingReminders()
        break
      case 'missed_briefing_detection':
        results[job] = await runMissedBriefingDetection()
        break
      case 'retry_failed_whatsapp':
        results[job] = await retryFailedWhatsApp()
        break
      case 'sla_escalations':
        results[job] = await runSlaEscalations()
        break
      default:
        results[job] = { error: 'Unknown job' }
    }
  }
  return results
}

async function getWorkflowTelemetry({ limit = 50 } = {}) {
  const db = await getWorkflowDb()
  const snap = await db.collection(WORKFLOW_COLLECTION).limit(200).get()
  const events = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => new Date(b.startedAt || 0) - new Date(a.startedAt || 0))

  const byStatus = {}
  for (const e of events) {
    byStatus[e.status] = (byStatus[e.status] || 0) + 1
  }

  return {
    total: events.length,
    byStatus,
    recent: events.slice(0, limit),
    failedQueue: events.filter((e) => e.status === 'failed' || e.status === 'retry_pending').slice(0, 20),
    slaBreaches: events.filter((e) => e.payload?.slaEscalation).length,
  }
}

module.exports = {
  SUPPORTED_EVENTS,
  dispatchWorkflowEvent,
  runScheduledAutomation,
  runTenderClosingReminders,
  runBriefingReminders,
  runMissedBriefingDetection,
  retryFailedWhatsApp,
  runSlaEscalations,
  getWorkflowTelemetry,
  workflowEventId,
}
