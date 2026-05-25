/**
 * Pilot CRM — leads, outreach, tasks, feedback (Firestore).
 */
const { getFirestore } = require('../config/firebaseAdmin')
const { sanitizeFirestoreData } = require('../utils/sanitizeFirestoreData')
const { buildMessage } = require('./pilotMessageTemplates')
const whatsappService = require('./whatsappService')

const COL = {
  leads: 'pilotLeads',
  outreach: 'pilotOutreach',
  tasks: 'pilotTasks',
  feedback: 'pilotFeedback',
}

const LEAD_STATUSES = ['new', 'contacted', 'interested', 'onboarded', 'rejected']
const LEAD_TYPES = ['sme', 'agent']
const TASK_TYPES = [
  'call_sme',
  'verify_agent',
  'follow_up_lead',
  'whatsapp_opt_in',
  'report_quality',
  'failed_dispatch',
]
const TASK_STATUSES = ['open', 'in_progress', 'done', 'cancelled']
const MESSAGE_TYPES = [
  'sme_invitation',
  'agent_recruitment',
  'follow_up',
  'reminder',
  'pilot_acceptance',
]

function nowIso() {
  return new Date().toISOString()
}

function db() {
  return getFirestore()
}

function normalizeLead(data, id) {
  return { id, ...data }
}

async function listLeads(filters = {}) {
  const snap = await db().collection(COL.leads).orderBy('updatedAt', 'desc').limit(500).get()
  let items = snap.docs.map((d) => normalizeLead(d.data(), d.id))

  if (filters.leadType) items = items.filter((l) => l.leadType === filters.leadType)
  if (filters.status) items = items.filter((l) => l.status === filters.status)
  if (filters.province) items = items.filter((l) => l.province === filters.province)
  if (filters.search) {
    const s = String(filters.search).toLowerCase()
    items = items.filter(
      (l) =>
        (l.name || '').toLowerCase().includes(s) ||
        (l.company || '').toLowerCase().includes(s) ||
        (l.email || '').toLowerCase().includes(s) ||
        (l.phoneNumber || '').includes(s)
    )
  }
  return items
}

async function getLead(leadId) {
  const doc = await db().collection(COL.leads).doc(leadId).get()
  if (!doc.exists) return null
  return normalizeLead(doc.data(), doc.id)
}

async function createLead(payload, adminUid) {
  const timestamp = nowIso()
  const lead = sanitizeFirestoreData({
    name: String(payload.name || '').trim(),
    company: String(payload.company || '').trim(),
    role: String(payload.role || '').trim(),
    email: String(payload.email || '').trim().toLowerCase(),
    phoneNumber: String(payload.phoneNumber || '').trim(),
    whatsappNumber: String(payload.whatsappNumber || payload.phoneNumber || '').trim(),
    province: String(payload.province || '').trim(),
    sector: String(payload.sector || '').trim(),
    source: String(payload.source || 'admin').trim(),
    leadType: LEAD_TYPES.includes(payload.leadType) ? payload.leadType : 'sme',
    status: LEAD_STATUSES.includes(payload.status) ? payload.status : 'new',
    notes: String(payload.notes || '').trim(),
    linkedUserId: payload.linkedUserId || null,
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: adminUid || null,
  })

  const ref = await db().collection(COL.leads).add(lead)
  return { id: ref.id, ...lead }
}

async function updateLead(leadId, patch, adminUid) {
  const ref = db().collection(COL.leads).doc(leadId)
  const existing = await ref.get()
  if (!existing.exists) throw new Error('Lead not found')

  const updates = sanitizeFirestoreData({
    ...patch,
    updatedAt: nowIso(),
    updatedBy: adminUid || null,
  })
  if (updates.status && !LEAD_STATUSES.includes(updates.status)) {
    delete updates.status
  }
  if (updates.leadType && !LEAD_TYPES.includes(updates.leadType)) {
    delete updates.leadType
  }
  await ref.set(updates, { merge: true })
  const doc = await ref.get()
  return normalizeLead(doc.data(), doc.id)
}

async function listOutreachForLead(leadId, limit = 50) {
  const snap = await db().collection(COL.outreach).where('leadId', '==', leadId).limit(limit).get()
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
}

async function logOutreach(entry) {
  const timestamp = nowIso()
  const doc = sanitizeFirestoreData({
    leadId: entry.leadId,
    messageType: entry.messageType,
    channel: entry.channel || 'whatsapp',
    to: entry.to || '',
    bodyPreview: String(entry.body || '').slice(0, 500),
    status: entry.status || 'logged',
    error: entry.error || null,
    twilioSid: entry.twilioSid || null,
    sentBy: entry.sentBy || null,
    createdAt: timestamp,
  })
  const ref = await db().collection(COL.outreach).add(doc)
  return { id: ref.id, ...doc }
}

async function sendLeadOutreach({ leadId, messageType, sendWhatsApp, adminUid }) {
  const lead = await getLead(leadId)
  if (!lead) throw new Error('Lead not found')
  if (!MESSAGE_TYPES.includes(messageType)) throw new Error('Invalid message type')

  const body = buildMessage(messageType, lead)
  const to = lead.whatsappNumber || lead.phoneNumber

  if (!sendWhatsApp) {
    const log = await logOutreach({
      leadId,
      messageType,
      channel: 'copy',
      to,
      body,
      status: 'copied',
      sentBy: adminUid,
    })
    return { ok: true, copied: true, body, outreach: log }
  }

  if (!to) {
    const log = await logOutreach({
      leadId,
      messageType,
      channel: 'whatsapp',
      to: '',
      body,
      status: 'failed',
      error: 'No phone number on lead',
      sentBy: adminUid,
    })
    return { ok: false, error: 'No phone number on lead', body, outreach: log }
  }

  const result = await whatsappService.sendWhatsAppMessage(to, body, {
    type: `pilot_${messageType}`,
    recipientRole: lead.leadType,
    recipientId: leadId,
    idempotencyKey: `pilot-${leadId}-${messageType}-${Date.now().toString().slice(0, 10)}`,
    metadata: { pilotLeadId: leadId, messageType },
  })

  const log = await logOutreach({
    leadId,
    messageType,
    channel: 'whatsapp',
    to,
    body,
    status: result.ok ? 'sent' : result.skipped ? 'skipped' : 'failed',
    error: result.error || result.reason || null,
    twilioSid: result.sid || null,
    sentBy: adminUid,
  })

  if (lead.status === 'new' && result.ok) {
    await updateLead(leadId, { status: 'contacted' }, adminUid)
  }

  return { ok: result.ok, body, outreach: log, whatsapp: result }
}

async function listTasks(filters = {}) {
  let q = db().collection(COL.tasks).orderBy('updatedAt', 'desc').limit(200)
  if (filters.status) q = q.where('status', '==', filters.status)
  const snap = await q.get()
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

async function createTask(payload, adminUid) {
  const timestamp = nowIso()
  const task = sanitizeFirestoreData({
    title: String(payload.title || '').trim() || defaultTaskTitle(payload.taskType),
    taskType: TASK_TYPES.includes(payload.taskType) ? payload.taskType : 'follow_up_lead',
    status: TASK_STATUSES.includes(payload.status) ? payload.status : 'open',
    leadId: payload.leadId || null,
    notes: String(payload.notes || '').trim(),
    dueAt: payload.dueAt || null,
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: adminUid || null,
  })
  const ref = await db().collection(COL.tasks).add(task)
  return { id: ref.id, ...task }
}

function defaultTaskTitle(taskType) {
  const map = {
    call_sme: 'Call SME lead',
    verify_agent: 'Verify Youth Agent',
    follow_up_lead: 'Follow up pilot lead',
    whatsapp_opt_in: 'Confirm WhatsApp opt-in',
    report_quality: 'Review briefing report quality',
    failed_dispatch: 'Resolve failed dispatch',
  }
  return map[taskType] || 'Pilot task'
}

async function updateTask(taskId, patch, adminUid) {
  const ref = db().collection(COL.tasks).doc(taskId)
  const existing = await ref.get()
  if (!existing.exists) throw new Error('Task not found')
  const updates = sanitizeFirestoreData({
    ...patch,
    updatedAt: nowIso(),
    updatedBy: adminUid || null,
  })
  if (updates.status && !TASK_STATUSES.includes(updates.status)) delete updates.status
  await ref.set(updates, { merge: true })
  const doc = await ref.get()
  return { id: doc.id, ...doc.data() }
}

async function submitFeedback(payload) {
  const timestamp = nowIso()
  const rating = Number(payload.rating)
  const doc = sanitizeFirestoreData({
    feedbackType: payload.feedbackType === 'agent' ? 'agent' : 'sme',
    userId: payload.userId || null,
    rating: rating >= 1 && rating <= 5 ? rating : null,
    comments: String(payload.comments || '').trim(),
    workflowIssue: String(payload.workflowIssue || '').trim(),
    reportQuality: payload.reportQuality != null ? Number(payload.reportQuality) : null,
    agentReliability: payload.agentReliability != null ? Number(payload.agentReliability) : null,
    platformUsability: payload.platformUsability != null ? Number(payload.platformUsability) : null,
    createdAt: timestamp,
  })
  const ref = await db().collection(COL.feedback).add(doc)
  return { id: ref.id, ...doc }
}

async function listFeedback(limit = 100) {
  const snap = await db()
    .collection(COL.feedback)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get()
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

module.exports = {
  COL,
  LEAD_STATUSES,
  LEAD_TYPES,
  TASK_TYPES,
  TASK_STATUSES,
  MESSAGE_TYPES,
  listLeads,
  getLead,
  createLead,
  updateLead,
  listOutreachForLead,
  logOutreach,
  sendLeadOutreach,
  listTasks,
  createTask,
  updateTask,
  submitFeedback,
  listFeedback,
}
