/**
 * Phase 10 — Operations Lifecycle service.
 * Admin-driven fulfilment after payment. Never charges PayFast. Never emails clients on deliver.
 */
const crypto = require('crypto')
const { getStorage } = require('../storageAdapter')
const { getFirebaseAdmin } = require('../../config/firebaseAdmin')
const auditLogService = require('../auditLogService')
const {
  deriveManualOpsStage,
  manualOpsLabel,
  deriveUrgencyFlags,
  nextRequiredAction,
  normalizeOpsStage,
  clampAgentPayoutCents,
  SUGGESTED_AGENT_PAYOUT_CENTS,
  OPS_EVIDENCE_CATEGORIES,
} = require('../../domain/manualBriefingOps')
const {
  evaluateOpsSla,
  classifyBoardFilter,
  EXCEPTION_CODES,
} = require('../../domain/opsSlaEngine')

const EVIDENCE_MAX_BYTES = 15 * 1024 * 1024
const EVIDENCE_ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
  'audio/mpeg',
  'audio/mp4',
  'audio/webm',
  'video/mp4',
  'video/webm',
])

async function getRequest(requestId) {
  const id = String(requestId || '').trim()
  if (!id) return null
  try {
    const db = getFirebaseAdmin().firestore()
    const snap = await db.collection('attendanceRequests').doc(id).get()
    if (snap.exists) return { id: snap.id, ...snap.data() }
  } catch {
    /* fall through to storage adapter */
  }
  const storage = getStorage()
  const all = await storage.getAttendanceRequests()
  return all.find((r) => r.id === id) || null
}

async function saveRequest(request) {
  const storage = getStorage()
  const next = {
    ...request,
    updatedAt: new Date().toISOString(),
    opsUpdatedAt: new Date().toISOString(),
  }
  next.opsStage = deriveManualOpsStage(next)
  await storage.saveAttendanceRequest(next)
  return next
}

function toOpsBoardRow(request) {
  if (!request) return null
  const stage = deriveManualOpsStage(request)
  const urgencyFlags = deriveUrgencyFlags(request)
  const sla = evaluateOpsSla(request)
  const isManual =
    request.source === 'manual_payment_link' ||
    request.bookingKind === 'manual' ||
    request.catalogueTenderRequired === false
  const recommended = sla.recommendedAction || {}
  let actionHref = null
  if (recommended.hrefPath === 'report') actionHref = `/admin/operations/report/${request.id}`
  else if (recommended.hrefPath === 'delivery') actionHref = `/admin/operations/delivery/${request.id}`

  return {
    id: request.id,
    companyName: request.smeCompany || request.smeName || '',
    contactPerson: request.contactPerson || '',
    customerEmail: request.smeEmail || '',
    customerPhone: request.smePhone || '',
    representedEntity:
      request.representedEntity || request.registerAttendOnBehalfOf || request.smeCompany || '',
    tenderNumber: request.tenderNumber || '',
    tenderDescription: request.tenderTitle || '',
    sourceKind: isManual ? 'manual' : 'catalogue',
    briefingDate: request.briefingDate || '',
    briefingTime: request.briefingTime || '',
    briefingVenue: request.briefingVenue || '',
    province: request.province || '',
    paymentStatus: request.paymentStatus || '',
    opsStage: stage,
    opsStageLabel: manualOpsLabel(stage),
    /** Legacy alias for older UI — same as assignment_required */
    legacyOpsStage:
      stage === 'assignment_required' ? 'paid_agent_required' : request.opsStage || stage,
    representativeName:
      request.representativeName ||
      request.assignmentCandidateName ||
      request.agentName ||
      request.assignedAgentName ||
      null,
    representativePhone: request.representativePhone || request.assignmentCandidatePhone || null,
    representativeEmail: request.assignmentCandidateEmail || null,
    representativePayoutCents: request.agentPayoutCents || request.representativePayoutCents || null,
    assignedAt: request.representativeAssignedAt || request.acceptedAt || request.assignmentAcceptedAt || null,
    assignmentSubstate: request.assignmentSubstate || null,
    assignmentAcceptanceDeadlineAt: request.assignmentAcceptanceDeadlineAt || null,
    assignmentAcceptanceUrgency: request.assignmentAcceptanceUrgency || null,
    assignmentDispatchedAt: request.assignmentDispatchedAt || null,
    assignmentDispatchId: request.assignmentDispatchId || null,
    urgencyFlags,
    lastOpsUpdate: request.opsUpdatedAt || request.updatedAt || request.paidAt || request.createdAt,
    nextAction: recommended.label || nextRequiredAction(stage),
    actionHref,
    evidenceCount: Array.isArray(request.evidenceItems) ? request.evidenceItems.length : 0,
    reportReadyAt: request.reportReadyAt || null,
    reportStatus: request.reportStatus || request.reportStage || null,
    opsReportId: request.opsReportId || null,
    opsReportVersion: request.opsReportVersion || null,
    reportFileName: request.reportFileName || null,
    reportDocxFileName: request.reportDocxFileName || null,
    clientDeliveryId: request.clientDeliveryId || null,
    clientDeliveryStatus: request.clientDeliveryStatus || null,
    clientDeliveryProviderStatus: request.clientDeliveryProviderStatus || null,
    deliveredAt: request.deliveredAt || null,
    completedAt: request.completedAt || null,
    finalReportVersionId: request.finalReportVersionId || null,
    finalDeliveryId: request.finalDeliveryId || null,
    reopenedAt: request.reopenedAt || null,
    closedAt: request.closedAt || null,
    invoiceNumber: request.invoiceNumber || null,
    amountCents: request.paymentAmount || request.briefingPriceCents || null,
    slaTrack: sla.track,
    exceptionCode: sla.exceptionCode,
    exceptionLabel: sla.exceptionLabel,
    overdueLabel: sla.overdueLabel,
    boardFilter: classifyBoardFilter(sla, request),
    briefingAtIso: sla.briefingAt,
  }
}

/**
 * Assign a human representative without requiring a Youth Agent account.
 * INTERNAL ONLY — payout never goes to SME views.
 */
async function assignManualRepresentative(requestId, input = {}, adminUser = {}) {
  const request = await getRequest(requestId)
  if (!request) throw new Error('Attendance request not found')

  const name = String(input.representativeName || input.name || '').trim()
  const phone = String(input.representativePhone || input.phone || '').trim()
  const notes = String(input.internalNotes || input.notes || '').trim()
  if (!name) throw new Error('Representative name is required')

  let payout = clampAgentPayoutCents(
    input.agentPayoutCents != null ? input.agentPayoutCents : input.payoutCents
  )
  if (payout == null && input.agentPayoutCents == null && input.payoutCents == null) {
    payout = SUGGESTED_AGENT_PAYOUT_CENTS
  }
  if (payout == null) {
    throw new Error('Payout must be between R100.00 and R600.00')
  }

  const payment = String(request.paymentStatus || '').toLowerCase()
  if (payment !== 'paid' && payment !== 'not_required') {
    throw new Error('Request must be paid before assignment')
  }

  const now = new Date().toISOString()
  const wasReassign = Boolean(request.representativeName || request.assignedAgentId)

  request.representativeName = name
  request.representativePhone = phone
  request.representativeInternalNotes = notes
  request.representativeAssignedAt = now
  request.representativeAssignedBy = adminUser.uid || null
  request.representativeAssignedByEmail = adminUser.email || null
  request.agentPayoutCents = payout
  request.representativePayoutCents = payout
  request.agentName = name
  // Offline / force confirm — stamps accepted without token accept
  request.assignmentSubstate = 'accepted'
  request.assignmentAcceptedAt = now
  request.assignmentCandidateName = name
  request.assignmentCandidatePhone = phone || null
  request.assignmentDispatchTokenHash = null
  request.assignmentDispatchTokenId = null
  // Do NOT invent a YA user id — leave agentId null unless already set
  if (!request.assignedAgentId && !request.agentId) {
    request.manualRepresentative = true
  }
  request.opsStage = 'assigned'
  request.status = request.status === 'pending' || !request.status ? 'assigned' : request.status

  const saved = await saveRequest(request)
  await auditLogService.logEvent({
    type: wasReassign ? 'ops_representative_reassigned' : 'ops_representative_assigned',
    entityId: requestId,
    actorId: adminUser.uid || 'admin',
    actorEmail: adminUser.email || null,
    representativeName: name,
    payoutCents: payout,
    forceAssign: true,
  })
  return saved
}

/** Phase 15 — dispatch for acceptance (preferred Ops path). */
async function dispatchRepresentative(requestId, input = {}, adminUser = {}) {
  const dispatch = require('./assignmentDispatchService')
  return dispatch.dispatchRepresentative(requestId, input, adminUser)
}

async function markAttended(requestId, input = {}, adminUser = {}) {
  const request = await getRequest(requestId)
  if (!request) throw new Error('Attendance request not found')
  if (!hasRep(request)) throw new Error('Assign a representative before marking attended')

  const now = new Date().toISOString()
  request.attended = true
  request.attendedAt = now
  request.attendedBy = adminUser.uid || null
  request.attendanceNote = String(input.note || '').trim() || null
  const evidenceN = Array.isArray(request.evidenceItems) ? request.evidenceItems.length : 0
  request.opsStage =
    evidenceN > 0 || request.evidenceOverride === true ? 'evidence_received' : 'evidence_required'

  const saved = await saveRequest(request)
  await auditLogService.logEvent({
    type: 'ops_attendance_marked',
    entityId: requestId,
    actorId: adminUser.uid || 'admin',
    opsStage: saved.opsStage,
  })
  return saved
}

function hasRep(request) {
  return Boolean(
    request.assignedAgentId ||
      request.agentId ||
      String(request.representativeName || '').trim()
  )
}

async function overrideEvidenceRequirement(requestId, input = {}, adminUser = {}) {
  const request = await getRequest(requestId)
  if (!request) throw new Error('Attendance request not found')
  request.evidenceOverride = true
  request.evidenceOverrideReason = String(input.reason || 'admin_override').slice(0, 240)
  request.evidenceOverrideAt = new Date().toISOString()
  request.evidenceOverrideBy = adminUser.uid || null
  request.opsStage = 'evidence_received'
  const saved = await saveRequest(request)
  await auditLogService.logEvent({
    type: 'ops_evidence_override',
    entityId: requestId,
    actorId: adminUser.uid || 'admin',
    reason: request.evidenceOverrideReason,
  })
  return saved
}

async function uploadEvidence(requestId, { buffer, fileName, contentType, category, size }, adminUser = {}) {
  const request = await getRequest(requestId)
  if (!request) throw new Error('Attendance request not found')

  const cat = String(category || 'other').trim().toLowerCase()
  if (!OPS_EVIDENCE_CATEGORIES.includes(cat)) {
    throw new Error(`Invalid evidence category. Allowed: ${OPS_EVIDENCE_CATEGORIES.join(', ')}`)
  }
  if (!buffer || !Buffer.isBuffer(buffer)) throw new Error('File buffer required')
  if (size > EVIDENCE_MAX_BYTES) throw new Error('File exceeds 15MB limit')
  const type = String(contentType || 'application/octet-stream')
  if (!EVIDENCE_ALLOWED_TYPES.has(type)) {
    throw new Error(`Unsupported file type: ${type}`)
  }

  const safeName = String(fileName || 'evidence')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 80)
  const evidenceId = `ev-${crypto.randomBytes(6).toString('hex')}`
  const storagePath = `ops-evidence/${requestId}/${evidenceId}-${safeName}`

  const admin = getFirebaseAdmin()
  const bucket = admin.storage().bucket()
  const gcsFile = bucket.file(storagePath)
  await gcsFile.save(buffer, {
    metadata: {
      contentType: type,
      metadata: {
        uploadedBy: String(adminUser.uid || 'admin'),
        requestId,
        category: cat,
      },
    },
    resumable: false,
  })

  const item = {
    id: evidenceId,
    category: cat,
    fileName: safeName,
    contentType: type,
    sizeBytes: size,
    storagePath,
    uploadedAt: new Date().toISOString(),
    uploadedBy: adminUser.uid || null,
    uploadedByEmail: adminUser.email || null,
  }

  const items = Array.isArray(request.evidenceItems) ? [...request.evidenceItems] : []
  items.push(item)
  request.evidenceItems = items
  request.evidenceCount = items.length
  if (request.attended === true || request.attendedAt) {
    request.opsStage = 'evidence_received'
  }

  const saved = await saveRequest(request)
  await auditLogService.logEvent({
    type: 'ops_evidence_uploaded',
    entityId: requestId,
    actorId: adminUser.uid || 'admin',
    evidenceId,
    category: cat,
    storagePath,
  })
  return { request: saved, evidence: item }
}

/** Admin-only signed URL for evidence — never public. */
async function getEvidenceSignedUrl(requestId, evidenceId, adminUser = {}) {
  const request = await getRequest(requestId)
  if (!request) throw new Error('Attendance request not found')
  const items = Array.isArray(request.evidenceItems) ? request.evidenceItems : []
  const item = items.find((e) => e.id === evidenceId)
  if (!item || !item.storagePath) throw new Error('Evidence not found')

  const admin = getFirebaseAdmin()
  const file = admin.storage().bucket().file(item.storagePath)
  const [url] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + 60 * 60 * 1000,
  })
  await auditLogService.logEvent({
    type: 'ops_evidence_accessed',
    entityId: requestId,
    actorId: adminUser.uid || 'admin',
    evidenceId,
  })
  return { url, evidence: item }
}

async function removeEvidence(requestId, evidenceId, adminUser = {}) {
  const request = await getRequest(requestId)
  if (!request) throw new Error('Attendance request not found')
  const items = Array.isArray(request.evidenceItems) ? request.evidenceItems : []
  const idx = items.findIndex((e) => e.id === evidenceId)
  if (idx < 0) throw new Error('Evidence not found')
  const [removed] = items.splice(idx, 1)
  request.evidenceItems = items
  request.evidenceCount = items.length
  if (request.attended && items.length === 0 && !request.evidenceOverride) {
    request.opsStage = 'evidence_required'
  }
  const saved = await saveRequest(request)
  await auditLogService.logEvent({
    type: 'ops_evidence_removed',
    entityId: requestId,
    actorId: adminUser.uid || 'admin',
    evidenceId,
    storagePath: removed.storagePath || null,
  })
  return saved
}

async function setReportInProgress(requestId, adminUser = {}) {
  const request = await getRequest(requestId)
  if (!request) throw new Error('Attendance request not found')
  request.reportStage = 'in_progress'
  request.reportStatus = 'in_progress'
  request.reportInProgressAt = new Date().toISOString()
  request.opsStage = 'report_in_progress'
  const saved = await saveRequest(request)
  await auditLogService.logEvent({
    type: 'ops_report_in_progress',
    entityId: requestId,
    actorId: adminUser.uid || 'admin',
  })
  return saved
}

/**
 * Stamp REPORT READY only after an approved report version exists.
 * Prefer reportProductionService.approveFinalReport — this is a safety gate /
 * idempotent stamp for already-approved production reports.
 */
async function markReportReady(requestId, input = {}, adminUser = {}) {
  const request = await getRequest(requestId)
  if (!request) throw new Error('Attendance request not found')

  const alreadyReady =
    request.reportStatus === 'ready' ||
    request.reportStage === 'ready' ||
    Boolean(request.reportReadyAt)
  if (!alreadyReady) {
    // Phase 11: cannot become REPORT READY without APPROVE FINAL
    const reports = require('./reportProductionService')
    const { report } = await reports.getActiveReport(requestId)
    if (!report || report.approvalStatus !== 'approved') {
      throw new Error(
        'Approve Final Report is required before Report Ready — generate, review, then approve'
      )
    }
  }

  const now = new Date().toISOString()
  request.reportStage = 'ready'
  request.reportStatus = 'ready'
  request.reportReadyAt = request.reportReadyAt || now
  request.reportReadyBy = request.reportReadyBy || adminUser.uid || null
  request.reportFilePath =
    String(input.reportFilePath || request.reportFilePath || '').trim() || null
  request.reportFileName =
    String(input.reportFileName || request.reportFileName || '').trim() || null
  request.reportDocxPath =
    String(input.reportDocxPath || request.reportDocxPath || '').trim() ||
    request.reportDocxPath ||
    null
  request.reportDocxFileName =
    String(input.reportDocxFileName || request.reportDocxFileName || '').trim() ||
    request.reportDocxFileName ||
    null
  request.opsStage = 'report_ready'
  const saved = await saveRequest(request)
  await auditLogService.logEvent({
    type: 'ops_report_ready',
    entityId: requestId,
    actorId: adminUser.uid || 'admin',
  })
  return saved
}

/**
 * Founder/admin marks report delivered after sending outside the platform.
 * MUST NOT send email.
 */
async function markDelivered(requestId, input = {}, adminUser = {}) {
  const request = await getRequest(requestId)
  if (!request) throw new Error('Attendance request not found')
  const stage = deriveManualOpsStage(request)
  if (stage !== 'report_ready' && stage !== 'delivered') {
    throw new Error('Report must be Report Ready before marking delivered')
  }
  const now = new Date().toISOString()
  request.deliveredAt = now
  request.reportDeliveredAt = now
  request.deliveredBy = adminUser.uid || null
  request.deliveredByEmail = adminUser.email || null
  request.deliveryNote = String(input.deliveryNote || input.note || '').trim() || null
  request.deliveryClientEmail =
    String(input.clientEmail || request.smeEmail || '').trim() || null
  request.opsStage = 'delivered'
  // Explicitly do NOT set closedAt — close is a separate action
  const saved = await saveRequest(request)
  await auditLogService.logEvent({
    type: 'ops_marked_delivered',
    entityId: requestId,
    actorId: adminUser.uid || 'admin',
    emailSent: false,
    deliveryNote: request.deliveryNote,
  })
  return { request: saved, emailSent: false }
}

async function closeRequest(requestId, input = {}, adminUser = {}) {
  const request = await getRequest(requestId)
  if (!request) throw new Error('Attendance request not found')
  const stage = deriveManualOpsStage(request)
  if (stage !== 'delivered' && stage !== 'completed' && stage !== 'closed') {
    throw new Error('Request must be Delivered or Completed before closing')
  }
  const now = new Date().toISOString()
  request.closedAt = now
  request.closedBy = adminUser.uid || null
  request.closeNote = String(input.note || '').trim() || null
  request.opsStage = 'closed'
  request.status = 'closed'
  const saved = await saveRequest(request)
  await auditLogService.logEvent({
    type: 'ops_closed',
    entityId: requestId,
    actorId: adminUser.uid || 'admin',
  })
  return saved
}

async function listOpsBoard({ limit = 150, filter = '' } = {}) {
  const storage = getStorage()
  let all = await storage.getAttendanceRequests()
  // Phase 15: expire overdue dispatches from canonical timestamps (not email delivery).
  try {
    const dispatch = require('./assignmentDispatchService')
    const { isDispatchPending, isAcceptanceExpired } = require('../../domain/assignmentDispatch')
    const now = new Date()
    for (const r of all) {
      if (isDispatchPending(r) && isAcceptanceExpired(r, now)) {
        await dispatch.expireDispatchIfNeeded(r.id, now)
      }
    }
    all = await storage.getAttendanceRequests()
  } catch {
    /* non-fatal */
  }
  let rows = all
    .map((r) => toOpsBoardRow(r))
    .filter(Boolean)
    .filter((r) => r.opsStage !== 'closed')

  const f = String(filter || '').trim().toLowerCase()
  if (f === 'needs_attention' || f === 'overdue') {
    rows = rows.filter(
      (r) =>
        r.boardFilter === 'needs_attention' ||
        r.slaTrack === 'OVERDUE' ||
        r.slaTrack === 'BLOCKED' ||
        Boolean(r.exceptionCode)
    )
  } else if (f === 'due_soon') {
    rows = rows.filter((r) => r.boardFilter === 'due_soon' || r.slaTrack === 'DUE_SOON')
  } else if (f === 'in_progress') {
    rows = rows.filter((r) => r.boardFilter === 'in_progress')
  } else if (f === 'ready_to_send') {
    rows = rows.filter((r) => r.boardFilter === 'ready_to_send' || r.opsStage === 'report_ready')
  } else if (f === 'delivery_issue') {
    rows = rows.filter((r) => r.boardFilter === 'delivery_issue')
  } else if (f === 'completed') {
    rows = rows.filter((r) => r.opsStage === 'completed' || Boolean(r.completedAt))
  } else if (f === 'paid_intake' || f === 'assignment_required') {
    // Phase 14/15: paid bookings awaiting representative selection/dispatch
    rows = rows.filter(
      (r) =>
        (r.paymentStatus === 'paid' || r.paymentStatus === 'not_required') &&
        (r.opsStage === 'assignment_required' ||
          r.opsStage === 'paid_agent_required' ||
          r.assignmentSubstate === 'reassignment_required' ||
          r.assignmentSubstate === 'declined' ||
          r.assignmentSubstate === 'expired')
    )
  } else if (f === 'awaiting_acceptance' || f === 'assignment_pending') {
    rows = rows.filter(
      (r) =>
        r.opsStage === 'assignment_pending' ||
        r.assignmentSubstate === 'dispatch_sent' ||
        r.assignmentSubstate === 'candidate_selected'
    )
  } else if (f === 'assigned') {
    rows = rows.filter(
      (r) =>
        r.opsStage === 'assigned' ||
        r.opsStage === 'briefing_due' ||
        r.assignmentSubstate === 'accepted'
    )
  } else if (f === 'reassignment_required' || f === 'declined') {
    rows = rows.filter(
      (r) =>
        r.assignmentSubstate === 'reassignment_required' ||
        r.assignmentSubstate === 'declined' ||
        r.assignmentSubstate === 'expired' ||
        r.exceptionCode === 'REPRESENTATIVE_DECLINED' ||
        r.exceptionCode === 'REPRESENTATIVE_RESPONSE_OVERDUE'
    )
  } else if (f === 'assignment_overdue') {
    rows = rows.filter(
      (r) =>
        r.exceptionCode === 'REPRESENTATIVE_RESPONSE_OVERDUE' ||
        r.exceptionCode === 'UNASSIGNED_APPROACHING_BRIEFING' ||
        (r.opsStage === 'assignment_required' && r.slaTrack === 'OVERDUE')
    )
  } else if (f === 'unpaid') {
    rows = rows.filter(
      (r) =>
        r.paymentStatus === 'pending' ||
        r.paymentStatus === 'failed' ||
        r.paymentStatus === 'cancelled' ||
        r.opsStage === 'payment_required'
    )
  } else if (f && Object.values(EXCEPTION_CODES).includes(f.toUpperCase())) {
    rows = rows.filter((r) => r.exceptionCode === f.toUpperCase())
  }

  rows.sort((a, b) => {
    const rank = { BLOCKED: 0, OVERDUE: 1, DUE_SOON: 2, ON_TRACK: 3 }
    const ra = rank[a.slaTrack] ?? 9
    const rb = rank[b.slaTrack] ?? 9
    if (ra !== rb) return ra - rb
    return String(b.lastOpsUpdate || '').localeCompare(String(a.lastOpsUpdate || ''))
  })

  return rows.slice(0, Math.min(Math.max(Number(limit) || 150, 1), 300))
}

/** Derived exception queue — no duplicate persistence on page load. */
async function listExceptionQueue({ limit = 100 } = {}) {
  const rows = await listOpsBoard({ limit: 300, filter: 'needs_attention' })
  return rows
    .filter((r) => r.exceptionCode)
    .slice(0, Math.min(Math.max(Number(limit) || 100, 1), 200))
}

/** Stamp paid → assignment_required after ITN (compat with paid_agent_required). */
function opsStageAfterPayment() {
  return 'assignment_required'
}

module.exports = {
  getRequest,
  saveRequest,
  toOpsBoardRow,
  listOpsBoard,
  assignManualRepresentative,
  dispatchRepresentative,
  markAttended,
  overrideEvidenceRequirement,
  uploadEvidence,
  getEvidenceSignedUrl,
  removeEvidence,
  setReportInProgress,
  markReportReady,
  markDelivered,
  closeRequest,
  listExceptionQueue,
  opsStageAfterPayment,
  deriveManualOpsStage,
  normalizeOpsStage,
  EVIDENCE_MAX_BYTES,
  EVIDENCE_ALLOWED_TYPES,
}
