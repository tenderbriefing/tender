/**
 * Real-time workflow orchestration — event dispatch, deduplication, retries, SLA, schedules.
 */
const { getFirestore } = require('../config/firebaseAdmin')
const { sanitizeFirestoreData } = require('../utils/sanitizeFirestoreData')
const notificationService = require('./notificationService')
const { getStorage } = require('./storageAdapter')
const pushNotificationService = require('./pushNotificationService')
const { randomUUID } = require('crypto')
const {
  DEFAULT_EXECUTION_BUDGET_MS,
  createExecutionBudget,
  readExecutionBudgetConfig,
} = require('./automation/executionBudget')
const {
  listJobs,
  getJobDefinition,
  validateJobName,
  encodeContinuation,
  decodeContinuation,
} = require('./automation/jobRegistry')
const automationState = require('./automation/automationStateStore')

const WORKFLOW_COLLECTION = 'workflowEvents'
const MAX_RETRIES = 3
const SLA_ACCEPT_MINUTES = 15
const SLA_ADMIN_ESCALATION_MINUTES = 60
const MISSED_BRIEFING_HOURS_AFTER = 4
const BRIEFING_REMINDER_HOURS_BEFORE = 2
const TENDER_CLOSING_HOURS = 24

const DEFAULT_AUTOMATION_BUDGET_MS = DEFAULT_EXECUTION_BUDGET_MS
const SCHEDULED_JOBS = listJobs().map((job) => job.name)
const STALE_RUN_LOCK_MS = 300_000

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
    try {
      const db = await getWorkflowDb()
      await db.collection('workflowFailures').doc(idempotencyKey).set(
        sanitizeFirestoreData({
          id: idempotencyKey,
          eventType,
          error: errMsg,
          retryCount,
          createdAt: nowIso(),
        }),
        { merge: true }
      )
    } catch {
      /* non-blocking */
    }
    return { success: false, workflowEvent: failed, error: errMsg }
  }
}

function parseDate(value) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Index every tracked tender by the ids a listing can match on, so the closing
 * sweep reads the `trackedTenders` collection group once instead of once per tender.
 */
function buildTrackedTenderIndex(docs) {
  const index = new Map()
  for (const doc of docs) {
    const entry = doc.data() || {}
    const smeId = doc.ref.parent.parent?.id
    if (!smeId) continue
    const keys = new Set()
    if (entry.tenderId) keys.add(entry.tenderId)
    if (entry.id) keys.add(entry.id)
    for (const key of keys) {
      const existing = index.get(key)
      if (existing) existing.push(smeId)
      else index.set(key, [smeId])
    }
  }
  return index
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

  const closingSoon = tenders.filter((tender) => {
    const closing = parseDate(tender.closingDate || tender.submissionDeadline)
    if (!closing) return false
    const t = closing.getTime()
    return t > now && t <= windowEnd
  })
  if (!closingSoon.length) return { job: 'tender_closing_reminders', triggered }

  const db = await getWorkflowDb()
  const workspaceSnap = await db.collectionGroup('trackedTenders').get().catch(() => null)
  if (!workspaceSnap) return { job: 'tender_closing_reminders', triggered }
  const trackedBySme = buildTrackedTenderIndex(workspaceSnap.docs)

  for (const tender of closingSoon) {
    const closing = parseDate(tender.closingDate || tender.submissionDeadline)
    for (const smeId of trackedBySme.get(tender.id) || []) {
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

async function archiveWhatsappNotification(db, id, reason, extra = {}) {
  await db
    .collection('notifications')
    .doc(id)
    .set(
      sanitizeFirestoreData({
        status: 'archived',
        retryable: false,
        archivedReason: reason,
        archivedAt: nowIso(),
        updatedAt: nowIso(),
        ...extra,
      }),
      { merge: true }
    )
}

async function retryFailedWhatsApp({ limit = 20 } = {}) {
  const db = await getWorkflowDb()
  const retryPolicy = require('./whatsappRetryPolicy')
  const snap = await db
    .collection('notifications')
    .where('channel', '==', 'whatsapp')
    .limit(200)
    .get()

  const candidates = snap.docs
    .map((d) => ({ id: d.id, ref: d.ref, ...d.data() }))
    .filter((n) => n.status === 'failed' || n.status === 'pending')
    .filter((n) => n.retryable !== false)
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))

  const whatsappService = require('./whatsappService')
  let retried = 0
  let sent = 0
  let skipped = 0
  let archived = 0

  for (const row of candidates) {
    if (retried >= limit) break

    const block = retryPolicy.getWhatsAppRetryBlockReason(row)
    if (block.blocked) {
      skipped += 1
      if (
        block.reason === 'qa_or_test' ||
        block.reason === 'short_non_operational' ||
        retryPolicy.shouldArchiveQaNotification(row)
      ) {
        await archiveWhatsappNotification(db, row.id, block.reason || 'retry_policy_skip')
        archived += 1
      }
      continue
    }

    if (!row.message || !row.to) {
      await archiveWhatsappNotification(db, row.id, 'missing_message_or_recipient')
      archived += 1
      continue
    }

    const result = await whatsappService.sendWhatsAppMessage(row.to, row.message, {
      type: row.type || 'retry',
      recipientRole: row.recipientRole,
      recipientId: row.recipientId,
      metadata: { ...(row.metadata || {}), retryOf: row.id, operationalRetry: true },
      idempotencyKey: `retry:${row.id}`,
    })
    retried += 1
    if (result.ok && !result.duplicate) sent += 1

    await archiveWhatsappNotification(db, row.id, result.ok ? 'retry_completed' : 'retry_failed', {
      status: result.ok ? 'retried' : 'failed',
      lastRetryAt: nowIso(),
      lastRetryOk: result.ok === true,
    })
    archived += 1
  }

  return { job: 'retry_failed_whatsapp', retried, sent, skipped, archived }
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

async function runSingleJob(job, options = {}) {
  if (options.signal?.aborted) {
    return { job, aborted: true, continuation: options.continuation || null }
  }
  const continuation = decodeContinuation(options.continuation) || {}
  const definition = getJobDefinition(job) || {}
  const signal = options.signal
  switch (job) {
    case 'tender_closing_reminders':
      return runTenderClosingReminders()
    case 'briefing_reminders':
      return runBriefingReminders()
    case 'missed_briefing_detection':
      return runMissedBriefingDetection()
    case 'retry_failed_whatsapp':
      return retryFailedWhatsApp()
    case 'sla_escalations':
      return runSlaEscalations()
    case 'smart_dispatch': {
      const liveDispatchService = require('./liveDispatchService')
      return liveDispatchService.runSmartDispatchAutomation()
    }
    case 'smart_procurement_ingestion': {
      const aggregation = require('./procurement/procurementAggregationService')
      return aggregation.runSmartProcurementIngestion({
        includeEtenders: false,
        sourceOffset: continuation.sourceOffset,
        sourceBatchSize: definition.batchSize,
        signal,
      })
    }
    case 'smart_escalation': {
      const smartEscalation = require('./ai/smartEscalationService')
      return smartEscalation.runSmartEscalations()
    }
    case 'no_show_prediction': {
      const noShow = require('./ai/noShowPredictionService')
      return noShow.runNoShowSweep()
    }
    case 'daily_procurement_brief': {
      const dailyBrief = require('./ai/dailyProcurementBriefService')
      return dailyBrief.runDailyProcurementBrief({
        skipNotifications: false,
        offset: continuation.offset,
        batchSize: definition.batchSize,
        runId: options.runId,
        signal,
      })
    }
    case 'procurement_watchlists': {
      const watchlist = require('./ai/procurementWatchlistService')
      return watchlist.refreshAllWatchlists({
        offset: continuation.offset,
        batchSize: definition.batchSize,
        signal,
      })
    }
    case 'procurement_memory': {
      const memory = require('./ai/procurementMemoryService')
      return memory.refreshProcurementMemory()
    }
    case 'procurement_forecasting': {
      const forecasting = require('./ai/procurementForecastingService')
      return forecasting.runProcurementForecasting()
    }
    case 'calendar_intelligence': {
      const calendarIntel = require('./calendarIntelligenceService')
      return calendarIntel.analyzeCalendar({
        offset: continuation.offset,
        batchSize: definition.batchSize,
        docId: 'global',
        signal,
      })
    }
    default:
      return { error: 'Unknown job' }
  }
}

function automationBudgetMs() {
  return readExecutionBudgetConfig().budgetMs
}

/** Start the sweep where the previous run ran out of budget, so no job starves. */
function rotateJobs(jobs, cursor) {
  if (!jobs.length) return []
  const parsed = Number(cursor)
  const normalized = Number.isFinite(parsed) ? Math.trunc(parsed) : 0
  const start = ((normalized % jobs.length) + jobs.length) % jobs.length
  return [...jobs.slice(start), ...jobs.slice(0, start)]
}

class AutomationJobTimeout extends Error {
  constructor(job, timeoutMs) {
    super(`Automation job ${job} exceeded its ${timeoutMs}ms slice`)
    this.name = 'AutomationJobTimeout'
    this.code = 'AUTOMATION_JOB_TIMEOUT'
  }
}

function withJobTimeout(work, timeoutMs, job, signal) {
  let timer = null
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      try {
        if (signal && typeof signal.abort === 'function' && !signal.aborted) {
          signal.abort()
        }
      } catch {
        // abort must never block timeout rejection
      }
      reject(new AutomationJobTimeout(job, timeoutMs))
    }, timeoutMs)
    if (typeof timer.unref === 'function') timer.unref()
  })
  return Promise.race([Promise.resolve().then(work), timeout]).finally(() => {
    if (timer) clearTimeout(timer)
  })
}

function isStaleRunLock(state, now) {
  if (!state || state.isRunning !== true) return false
  const startedAt = new Date(state.runStartedAt || 0).getTime()
  if (!startedAt || Number.isNaN(startedAt)) return true
  return now - startedAt > STALE_RUN_LOCK_MS
}

/**
 * Run the scheduled sweep inside a wall-clock budget. Whatever does not fit is
 * deferred to the next run instead of holding the request open until Cloud Run
 * returns a 504.
 */
async function runScheduledAutomation(jobName = 'all', options = {}) {
  if (!validateJobName(jobName)) {
    const error = new Error(`Unknown automation job: ${jobName}`)
    error.code = 'INVALID_AUTOMATION_JOB'
    throw error
  }
  const runJob = options.runJob || runSingleJob
  const clock = typeof options.now === 'function' ? options.now : Date.now
  const configured = readExecutionBudgetConfig(options.env)
  const budget = createExecutionBudget({
    now: clock,
    config: {
      ...configured,
      budgetMs: Number.isFinite(options.budgetMs) && options.budgetMs > 0
        ? Math.min(options.budgetMs, configured.requestTimeoutMs - configured.safetyMarginMs)
        : configured.budgetMs,
    },
  })
  const runId = options.runId || randomUUID()
  const startedAt = budget.metadata().startedAt

  if (jobName !== 'all') {
    const jobs = {}
    jobs[jobName] = await runJob(jobName, { runId, continuation: options.continuation })
    const result = {
      runId,
      status: 'completed',
      startedAt,
      durationMs: budget.elapsedMs(),
      completedJobs: [jobName],
      deferredJobs: [],
      timedOutJobs: [],
      jobs,
    }
    await automationState.saveRun({ ...result, job: jobName, completedAt: nowIso() })
    return result
  }

  const lease = options.lock === false
    ? { acquired: true, ownerId: runId, continuations: {} }
    : await automationState.acquireLease({
      ownerId: runId,
      now: budget.startedAtMs,
      ttlMs: configured.requestTimeoutMs,
    })
  if (!lease.acquired) {
    const result = {
      runId,
      status: 'skipped_overlap',
      reason: 'automation_lease_held',
      startedAt,
      leaseExpiresAt: lease.expiresAt || null,
      durationMs: budget.elapsedMs(),
      completedJobs: [],
      deferredJobs: [...SCHEDULED_JOBS],
      timedOutJobs: [],
      jobs: {},
    }
    await automationState.saveRun({ ...result, job: 'all', completedAt: nowIso() })
    const { logEvent } = require('./observabilityBridge')
    logEvent({
      event: 'automation_run_skipped_overlap',
      runId,
      status: result.status,
      durationMs: result.durationMs,
      outcome: 'ignored',
    })
    return result
  }

  const persisted = lease.continuations || {}
  const topLevel = decodeContinuation(options.continuation) || {}
  const cursor = Number.isFinite(options.cursor)
    ? options.cursor
    : Number.isFinite(topLevel.jobIndex) ? topLevel.jobIndex : 0
  const ordered = rotateJobs(SCHEDULED_JOBS, cursor)
  const jobs = {}
  const durationsMs = {}
  const completedJobs = []
  const timedOutJobs = []
  const errors = []
  const continuations = { ...persisted }
  let deferredJobs = []

  for (let i = 0; i < ordered.length; i += 1) {
    const job = ordered[i]
    const definition = getJobDefinition(job)
    const minimumStartMs = Number.isFinite(options.minJobSliceMs)
      ? options.minJobSliceMs
      : definition.minStartMs
    if (!budget.canStart(minimumStartMs)) {
      deferredJobs = ordered.slice(i)
      break
    }

    const jobStartedMs = clock()
    const abortController =
      typeof AbortController !== 'undefined' ? new AbortController() : null
    try {
      const sliceMs = budget.remainingMs()
      jobs[job] = await withJobTimeout(
        () => runJob(job, {
          runId,
          continuation: continuations[job] || null,
          idempotencyKey: `automation:${job}:${runId}`,
          signal: abortController?.signal,
        }),
        sliceMs,
        job,
        abortController
      )
      const next = jobs[job]?.continuation
      if (next) continuations[job] = encodeContinuation(next)
      else delete continuations[job]
      completedJobs.push(job)
    } catch (error) {
      if (error instanceof AutomationJobTimeout || error?.code === 'AUTOMATION_JOB_TIMEOUT') {
        jobs[job] = { job, timedOut: true, budgetMs: budget.remainingMs() }
        timedOutJobs.push(job)
        durationsMs[job] = clock() - jobStartedMs
        deferredJobs = ordered.slice(i + 1)
        break
      }
      const summary = String(error instanceof Error ? error.message : 'Job failed').slice(0, 240)
      jobs[job] = { job, error: summary }
      errors.push({ job, code: error?.code || 'JOB_FAILED', message: summary })
      completedJobs.push(job)
    }
    durationsMs[job] = clock() - jobStartedMs
  }

  const firstUnfinished = deferredJobs[0] || null
  const nextCursor = firstUnfinished ? SCHEDULED_JOBS.indexOf(firstUnfinished) : cursor
  const status = deferredJobs.length || timedOutJobs.length ? 'partial' : 'completed'
  const durationMs = budget.elapsedMs()
  const continuation = status === 'partial'
    ? encodeContinuation({ jobIndex: nextCursor })
    : null

  const result = {
    runId,
    status,
    startedAt,
    durationMs,
    completedAt: new Date(clock()).toISOString(),
    budget: budget.metadata(),
    cursor,
    nextCursor,
    continuation,
    jobContinuations: continuations,
    completedJobs,
    deferredJobs,
    timedOutJobs,
    errors: errors.slice(0, 10),
    durationsMs,
    jobs,
  }
  if (options.lock !== false) {
    await automationState.releaseLease({
      ownerId: runId,
      continuations,
      now: clock(),
      // Slice timeout aborts the AbortSignal for cooperative jobs. Keep the lease
      // until expiry after a slice timeout so Scheduler retries cannot overlap
      // residual non-cooperative work that may still be draining.
      keepUntilExpiry: timedOutJobs.length > 0,
    })
  }
  await automationState.saveRun({ ...result, job: 'all' })
  const { logEvent } = require('./observabilityBridge')
  logEvent({
    event: 'automation_run_completed',
    runId,
    status,
    durationMs,
    completedJobCount: completedJobs.length,
    deferredJobCount: deferredJobs.length,
    timedOutJobCount: timedOutJobs.length,
    errorCount: errors.length,
    outcome: status === 'completed' ? 'success' : 'ignored',
  })
  return result
}

async function getWorkflowTelemetry({ limit = 50 } = {}) {
  const db = await getWorkflowDb()
  const [snap, automation] = await Promise.all([
    db.collection(WORKFLOW_COLLECTION).limit(200).get(),
    automationState.getOperationalState({ limit }),
  ])
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
    automation,
  }
}

module.exports = {
  SUPPORTED_EVENTS,
  SCHEDULED_JOBS,
  DEFAULT_AUTOMATION_BUDGET_MS,
  STALE_RUN_LOCK_MS,
  listJobs,
  validateJobName,
  automationBudgetMs,
  rotateJobs,
  isStaleRunLock,
  buildTrackedTenderIndex,
  dispatchWorkflowEvent,
  runScheduledAutomation,
  runTenderClosingReminders,
  runBriefingReminders,
  runMissedBriefingDetection,
  retryFailedWhatsApp,
  runSlaEscalations,
  getWorkflowTelemetry,
  getAutomationOperationalState: automationState.getOperationalState,
  workflowEventId,
}
