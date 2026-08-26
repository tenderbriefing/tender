/**
 * Youth Agent Workspace — server service (Admin SDK).
 * Assignment lifecycle reuses attendanceLifecycle / lifecycleEnforcement.
 */
const { getFirestore } = require('../../config/firebaseAdmin')
const { sanitizeFirestoreData } = require('../../utils/sanitizeFirestoreData')
const { nowIso } = require('../ai/_shared')
const lifecycle = require('../domain/lifecycleEnforcement')
const mobileField = require('../mobile/mobileFieldService')
const agentPerformance = require('../agentPerformanceService')

const COL = {
  audit: 'agentWorkspaceAuditEvents',
  drafts: 'fieldReportDrafts',
  messages: 'assignmentMessages',
  ledger: 'agentEarningsLedger',
  analytics: 'agentWorkspaceAnalytics',
}

function centsToZar(cents) {
  return `R${(Number(cents || 0) / 100).toFixed(2)}`
}

async function appendAuditEvent(event) {
  const db = getFirestore()
  const doc = sanitizeFirestoreData({
    ...event,
    createdAt: event.createdAt || nowIso(),
  })
  const ref = await db.collection(COL.audit).add(doc)
  return { id: ref.id, ...doc }
}

async function getTodayBoard(agentId) {
  const board = await mobileField.getMobileDispatchBoard(agentId)
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)

  const isToday = (item) => {
    const d = String(item.briefingDate || '').slice(0, 10)
    return d === todayStr
  }

  const todayAssignments = (board.assignments || []).filter(isToday)
  const todayOpps = (board.opportunities || []).filter(isToday)
  const active = (board.assignments || []).filter((a) =>
    ['accepted', 'en_route', 'arrived', 'in_progress', 'assigned'].includes(a.status)
  )

  return {
    date: todayStr,
    todayAssignments,
    todayOpportunities: todayOpps,
    activeFieldWork: active,
    summary: {
      todayCount: todayAssignments.length + todayOpps.length,
      activeCount: active.length,
      opportunityCount: (board.opportunities || []).length,
    },
  }
}

async function listAssignments(agentId) {
  const board = await mobileField.getMobileDispatchBoard(agentId)
  return {
    assignments: board.assignments || [],
    opportunities: board.opportunities || [],
    all: board.all || [],
  }
}

async function getAssignmentDetail(requestId, agentId) {
  const detail = await mobileField.getBriefingDetail(requestId, agentId)
  if (!detail?.request) return null
  const req = detail.request
  const assigned =
    req.agentId === agentId ||
    req.assignedAgentId === agentId ||
    (Array.isArray(req.notifiedAgents) && req.notifiedAgents.includes(agentId))
  if (!assigned) return null

  const db = getFirestore()
  const [draftSnap, msgSnap, auditSnap] = await Promise.all([
    db
      .collection(COL.drafts)
      .where('requestId', '==', requestId)
      .where('agentId', '==', agentId)
      .limit(1)
      .get()
      .catch(() => ({ docs: [] })),
    db
      .collection(COL.messages)
      .where('requestId', '==', requestId)
      .limit(50)
      .get()
      .catch(() => ({ docs: [] })),
    db
      .collection(COL.audit)
      .where('requestId', '==', requestId)
      .limit(40)
      .get()
      .catch(() => ({ docs: [] })),
  ])

  const draft = draftSnap.docs[0] ? { id: draftSnap.docs[0].id, ...draftSnap.docs[0].data() } : null
  const messages = msgSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((m) => m.senderId === agentId || m.recipientId === agentId)
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))

  const audit = auditSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))

  // Strip AI summary unless caller already gated via existing AI flags upstream.
  // Workspace detail never invents facts — only pass through when present.
  return {
    request: req,
    tender: detail.tender || {},
    aiSummary: detail.aiSummary || null,
    gpsEvents: detail.gpsEvents || [],
    coordinates: detail.coordinates || null,
    fieldReportDraft: draft,
    messages,
    auditEvents: audit,
    allowedTransitions: listAgentTransitions(req.status),
  }
}

function listAgentTransitions(fromRaw) {
  const from = lifecycle.normalizeWorkflow(fromRaw)
  const candidates = ['accepted', 'en_route', 'arrived', 'in_progress', 'completed']
  return candidates.filter((to) => {
    try {
      lifecycle.assertWorkflowTransition(from, to, 'youth-agent')
      return from !== to
    } catch {
      return false
    }
  })
}

async function transitionAssignment(requestId, agentId, toStatus, meta = {}) {
  const db = getFirestore()
  const ref = db.collection('attendanceRequests').doc(requestId)
  const snap = await ref.get()
  if (!snap.exists) throw new Error('Assignment not found')
  const data = snap.data()
  const isAssignee =
    data.agentId === agentId ||
    data.assignedAgentId === agentId ||
    (Array.isArray(data.notifiedAgents) && data.notifiedAgents.includes(agentId))
  if (!isAssignee) throw new Error('Not assigned to this request')

  lifecycle.assertWorkflowTransition(data.status, toStatus, 'youth-agent')

  const patch = sanitizeFirestoreData({
    status: toStatus,
    updatedAt: nowIso(),
    ...(toStatus === 'accepted'
      ? { acceptedAt: nowIso(), agentId, assignedAgentId: agentId }
      : {}),
    ...(meta.note ? { lastAgentNote: String(meta.note).slice(0, 500) } : {}),
  })
  await ref.set(patch, { merge: true })

  await appendAuditEvent({
    type: 'assignment_transition',
    actorUid: agentId,
    actorRole: 'youth-agent',
    requestId,
    assignmentId: requestId,
    payload: { from: data.status, to: toStatus },
  })

  return { id: requestId, ...data, ...patch }
}

async function saveFieldReportDraft(agentId, payload) {
  const db = getFirestore()
  const requestId = payload.requestId
  if (!requestId) throw new Error('requestId required')

  const reqSnap = await db.collection('attendanceRequests').doc(requestId).get()
  if (!reqSnap.exists) throw new Error('Assignment not found')
  const req = reqSnap.data()
  const isAssignee = req.agentId === agentId || req.assignedAgentId === agentId
  if (!isAssignee) throw new Error('Not assigned')

  const existing = await db
    .collection(COL.drafts)
    .where('requestId', '==', requestId)
    .where('agentId', '==', agentId)
    .limit(1)
    .get()

  let current = existing.docs[0] ? { id: existing.docs[0].id, ...existing.docs[0].data() } : null
  if (current && ['locked', 'verified', 'submitted'].includes(current.status)) {
    throw new Error('Field report is locked and cannot be edited')
  }

  const doc = sanitizeFirestoreData({
    requestId,
    agentId,
    smeId: req.smeId,
    status: current?.status === 'rejected' ? 'draft' : current?.status || 'draft',
    notes: payload.notes != null ? String(payload.notes).slice(0, 8000) : current?.notes || '',
    structuredNotes: payload.structuredNotes || current?.structuredNotes || {},
    attendanceProofUrl: payload.attendanceProofUrl ?? current?.attendanceProofUrl ?? null,
    photoUrls: payload.photoUrls || current?.photoUrls || [],
    documentUrls: payload.documentUrls || current?.documentUrls || [],
    audioUrl: payload.audioUrl ?? current?.audioUrl ?? null,
    updatedAt: nowIso(),
    createdAt: current?.createdAt || nowIso(),
  })

  if (current?.id) {
    await db.collection(COL.drafts).doc(current.id).set(doc, { merge: true })
    await appendAuditEvent({
      type: 'report_draft_saved',
      actorUid: agentId,
      actorRole: 'youth-agent',
      requestId,
      payload: { draftId: current.id },
    })
    return { id: current.id, ...doc }
  }

  const ref = await db.collection(COL.drafts).add(doc)
  await appendAuditEvent({
    type: 'report_draft_saved',
    actorUid: agentId,
    actorRole: 'youth-agent',
    requestId,
    payload: { draftId: ref.id },
  })
  return { id: ref.id, ...doc }
}

async function submitFieldReport(agentId, requestId) {
  const db = getFirestore()
  const snap = await db
    .collection(COL.drafts)
    .where('requestId', '==', requestId)
    .where('agentId', '==', agentId)
    .limit(1)
    .get()
  if (snap.empty) throw new Error('No draft to submit')
  const docRef = snap.docs[0].ref
  const data = snap.docs[0].data()
  if (data.status === 'locked' || data.status === 'verified') {
    throw new Error('Already locked')
  }

  const patch = sanitizeFirestoreData({
    status: 'submitted',
    submittedAt: nowIso(),
    updatedAt: nowIso(),
  })
  await docRef.set(patch, { merge: true })

  // Lock shortly after submit (system)
  const lockPatch = sanitizeFirestoreData({
    status: 'locked',
    lockedAt: nowIso(),
    lockedBy: 'system',
    updatedAt: nowIso(),
  })
  await docRef.set(lockPatch, { merge: true })

  await appendAuditEvent({
    type: 'report_submitted',
    actorUid: agentId,
    actorRole: 'youth-agent',
    requestId,
    payload: { draftId: snap.docs[0].id },
  })
  await appendAuditEvent({
    type: 'report_locked',
    actorUid: 'system',
    actorRole: 'system',
    requestId,
    payload: { draftId: snap.docs[0].id },
  })

  const reqSnap = await db.collection('attendanceRequests').doc(requestId).get()

  return { id: snap.docs[0].id, ...data, ...patch, ...lockPatch }
}

async function verifyFieldReport(smeId, requestId, decision, notes = '') {
  const db = getFirestore()
  const reqSnap = await db.collection('attendanceRequests').doc(requestId).get()
  if (!reqSnap.exists) throw new Error('Assignment not found')
  const req = reqSnap.data()
  if (req.smeId !== smeId) throw new Error('Not your assignment')

  const snap = await db.collection(COL.drafts).where('requestId', '==', requestId).limit(1).get()
  if (snap.empty) throw new Error('No field report')
  const data = snap.docs[0].data()
  if (!['submitted', 'locked'].includes(data.status)) {
    throw new Error(`Cannot verify from status ${data.status}`)
  }

  const status = decision === 'reject' ? 'rejected' : 'verified'
  const patch = sanitizeFirestoreData({
    status,
    verifiedAt: nowIso(),
    verifiedBy: smeId,
    verificationNotes: String(notes || '').slice(0, 2000),
    updatedAt: nowIso(),
  })
  await snap.docs[0].ref.set(patch, { merge: true })

  await appendAuditEvent({
    type: 'sme_verification',
    actorUid: smeId,
    actorRole: 'sme',
    requestId,
    payload: { decision: status, draftId: snap.docs[0].id },
  })

  return { id: snap.docs[0].id, ...data, ...patch }
}

async function listMessages(agentId, requestId = null) {
  const db = getFirestore()
  let q = db.collection(COL.messages).where('recipientId', '==', agentId).limit(40)
  const [asRecipient, asSender] = await Promise.all([
    q.get().catch(() => ({ docs: [] })),
    db
      .collection(COL.messages)
      .where('senderId', '==', agentId)
      .limit(40)
      .get()
      .catch(() => ({ docs: [] })),
  ])

  const map = new Map()
  for (const d of [...asRecipient.docs, ...asSender.docs]) {
    const row = { id: d.id, ...d.data() }
    if (requestId && row.requestId !== requestId) continue
    map.set(d.id, row)
  }
  return Array.from(map.values()).sort((a, b) =>
    String(b.createdAt).localeCompare(String(a.createdAt))
  )
}

async function sendMessage(actor, { requestId, body, recipientId }) {
  const db = getFirestore()
  if (!requestId || !body) throw new Error('requestId and body required')
  const text = String(body).trim().slice(0, 4000)
  if (!text) throw new Error('Empty message')

  const reqSnap = await db.collection('attendanceRequests').doc(requestId).get()
  if (!reqSnap.exists) throw new Error('Assignment not found')
  const req = reqSnap.data()

  let allowed = false
  let resolvedRecipient = recipientId
  if (actor.userType === 'admin') {
    allowed = true
    resolvedRecipient = recipientId || req.agentId || req.smeId
  } else if (actor.userType === 'youth-agent') {
    allowed = req.agentId === actor.uid || req.assignedAgentId === actor.uid
    resolvedRecipient = req.smeId
  } else if (actor.userType === 'sme') {
    allowed = req.smeId === actor.uid
    resolvedRecipient = req.agentId || req.assignedAgentId
  }
  if (!allowed || !resolvedRecipient) throw new Error('Not allowed to message on this assignment')

  const doc = sanitizeFirestoreData({
    requestId,
    senderId: actor.uid,
    senderRole: actor.userType,
    recipientId: resolvedRecipient,
    body: text,
    createdAt: nowIso(),
    readAt: null,
  })
  const ref = await db.collection(COL.messages).add(doc)

  await appendAuditEvent({
    type: 'message_sent',
    actorUid: actor.uid,
    actorRole: actor.userType,
    requestId,
    payload: { messageId: ref.id },
  })

  return { id: ref.id, ...doc }
}

async function getLedgerBalance(agentId) {
  const db = getFirestore()
  const snap = await db
    .collection(COL.ledger)
    .where('agentId', '==', agentId)
    .limit(200)
    .get()
    .catch(() => ({ docs: [] }))

  const entries = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))

  const last = entries[entries.length - 1]
  const balanceCents = last?.balanceAfterCents ?? 0
  return {
    balanceCents,
    balanceZar: centsToZar(balanceCents),
    entries: entries.slice(-50).reverse(),
    currency: 'ZAR',
  }
}

/**
 * Append-only earnings ledger. Never updates existing rows.
 */
async function appendEarningsEntry(agentId, { type, amountCents, description, requestId, createdBy }) {
  const db = getFirestore()
  const current = await getLedgerBalance(agentId)
  const delta = Number(amountCents) || 0
  const balanceAfterCents = current.balanceCents + delta
  const doc = sanitizeFirestoreData({
    agentId,
    requestId: requestId || null,
    type,
    amountCents: delta,
    currency: 'ZAR',
    description: String(description || type).slice(0, 500),
    balanceAfterCents,
    createdAt: nowIso(),
    createdBy: createdBy || agentId,
    immutable: true,
  })
  const ref = await db.collection(COL.ledger).add(doc)
  await appendAuditEvent({
    type: 'earnings_ledger_append',
    actorUid: createdBy || agentId,
    actorRole: 'system',
    requestId: requestId || null,
    payload: { ledgerId: ref.id, type, amountCents: delta },
  })
  return { id: ref.id, ...doc }
}

async function getExplainablePerformance(agentId) {
  const ranked = await agentPerformance.rankAllAgents()
  const me = ranked.find((r) => r.agentId === agentId)
  const mobile = await mobileField.getAgentPerformanceMobile(agentId)

  // Rebuild factor breakdown from known inputs (no invented metrics).
  const factors = []
  const score = me?.performanceScore ?? mobile.performanceScore ?? 50
  factors.push({
    key: 'composite',
    label: 'Composite score',
    contribution: score,
    detail: 'Derived from completion, ratings, speed, and reliability (see agentPerformanceService)',
  })
  if (me?.tier || mobile.tier) {
    factors.push({
      key: 'tier',
      label: 'Tier',
      contribution: 0,
      detail: `Current tier: ${me?.tier || mobile.tier}`,
    })
  }
  factors.push({
    key: 'attendance',
    label: 'Attendance',
    contribution: 0,
    detail: `Attendance ${mobile.attendancePct}% · missed ${mobile.missedBriefings}`,
  })
  factors.push({
    key: 'report_quality',
    label: 'Report quality',
    contribution: 0,
    detail: `Reporting quality index ${mobile.reportQuality}`,
  })
  if (mobile.fraudFlags > 0) {
    factors.push({
      key: 'fraud_flags',
      label: 'Fraud flags',
      contribution: 0,
      detail: `${mobile.fraudFlags} open fraud alert(s)`,
    })
  }

  return {
    score,
    tier: me?.tier || mobile.tier || 'Silver',
    factors,
    reliabilityScore: me?.reliabilityScore ?? mobile.reliabilityScore,
    attendancePct: mobile.attendancePct,
    missedBriefings: mobile.missedBriefings,
    fraudFlags: mobile.fraudFlags,
    computedAt: nowIso(),
  }
}

async function getProfile(agentId) {
  const db = getFirestore()
  const [userSnap, agentSnap, verificationSnap] = await Promise.all([
    db.collection('users').doc(agentId).get(),
    db.collection('agents').doc(agentId).get(),
    db.collection('agentVerification').doc(agentId).get(),
  ])
  const user = userSnap.exists ? userSnap.data() : {}
  const agent = agentSnap.exists ? agentSnap.data() : {}
  const verification = verificationSnap.exists ? verificationSnap.data() : {}

  // Never expose founder/admin/SME surfaces.
  return {
    uid: agentId,
    displayName: user.displayName || agent.name || user.email || 'Agent',
    email: user.email || null,
    phone: user.phone || agent.phone || null,
    province: agent.province || user.province || null,
    verified: Boolean(agent.verified || verification.status === 'verified'),
    verificationStatus: verification.status || (agent.verified ? 'verified' : 'pending'),
    transportAvailable: agent.transportAvailable === true,
    reliabilityScore: agent.reliabilityScore ?? null,
    userType: 'youth-agent',
  }
}

async function recordAnalytics(agentId, event, metadata = {}) {
  const db = getFirestore()
  const doc = sanitizeFirestoreData({
    agentId,
    event,
    metadata,
    createdAt: nowIso(),
  })
  const ref = await db.collection(COL.analytics).add(doc)
  return { id: ref.id, ...doc }
}

async function adminOverview({ limit = 40 } = {}) {
  const db = getFirestore()
  const [auditSnap, draftSnap, analyticsSnap] = await Promise.all([
    db.collection(COL.audit).orderBy('createdAt', 'desc').limit(limit).get().catch(() => ({ docs: [] })),
    db.collection(COL.drafts).where('status', 'in', ['submitted', 'locked']).limit(30).get().catch(() => ({ docs: [] })),
    db.collection(COL.analytics).orderBy('createdAt', 'desc').limit(limit).get().catch(() => ({ docs: [] })),
  ])
  return {
    recentAudit: auditSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    pendingVerification: draftSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    recentAnalytics: analyticsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
  }
}

async function syncEarningsFromPayouts(agentId) {
  const earnings = await mobileField.getAgentEarnings(agentId)
  const ledger = await getLedgerBalance(agentId)
  // Only seed if ledger empty — avoid double-counting.
  if (ledger.entries.length === 0 && earnings.paidEarningsCents > 0) {
    await appendEarningsEntry(agentId, {
      type: 'payout_paid',
      amountCents: earnings.paidEarningsCents,
      description: 'Opening balance from paid payouts',
      createdBy: 'system',
    })
  }
  if (ledger.entries.length === 0 && earnings.pendingPayoutCents > 0) {
    await appendEarningsEntry(agentId, {
      type: 'payout_pending',
      amountCents: earnings.pendingPayoutCents,
      description: 'Pending payouts (informational)',
      createdBy: 'system',
    })
  }
  const refreshed = await getLedgerBalance(agentId)
  return { earnings, ledger: refreshed }
}

module.exports = {
  COL,
  appendAuditEvent,
  getTodayBoard,
  listAssignments,
  getAssignmentDetail,
  transitionAssignment,
  saveFieldReportDraft,
  submitFieldReport,
  verifyFieldReport,
  listMessages,
  sendMessage,
  getLedgerBalance,
  appendEarningsEntry,
  getExplainablePerformance,
  getProfile,
  recordAnalytics,
  adminOverview,
  syncEarningsFromPayouts,
  centsToZar,
}
