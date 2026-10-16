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
  const isManual =
    request.source === 'manual_payment_link' ||
    request.bookingKind === 'manual' ||
    request.catalogueTenderRequired === false
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
      request.representativeName || request.agentName || request.assignedAgentName || null,
    representativePhone: request.representativePhone || null,
    representativePayoutCents: request.agentPayoutCents || request.representativePayoutCents || null,
    assignedAt: request.representativeAssignedAt || request.acceptedAt || null,
    urgencyFlags,
    lastOpsUpdate: request.opsUpdatedAt || request.updatedAt || request.paidAt || request.createdAt,
    nextAction: nextRequiredAction(stage),
    evidenceCount: Array.isArray(request.evidenceItems) ? request.evidenceItems.length : 0,
    reportReadyAt: request.reportReadyAt || null,
    deliveredAt: request.deliveredAt || null,
    closedAt: request.closedAt || null,
    invoiceNumber: request.invoiceNumber || null,
    amountCents: request.paymentAmount || request.briefingPriceCents || null,
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
  })
  return saved
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

async function markReportReady(requestId, input = {}, adminUser = {}) {
  const request = await getRequest(requestId)
  if (!request) throw new Error('Attendance request not found')
  const now = new Date().toISOString()
  request.reportStage = 'ready'
  request.reportStatus = 'ready'
  request.reportReadyAt = now
  request.reportReadyBy = adminUser.uid || null
  request.reportFilePath = String(input.reportFilePath || request.reportFilePath || '').trim() || null
  request.reportFileName = String(input.reportFileName || request.reportFileName || '').trim() || null
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
  if (stage !== 'delivered' && stage !== 'closed') {
    throw new Error('Request must be Delivered before closing')
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

async function listOpsBoard({ limit = 150 } = {}) {
  const storage = getStorage()
  const all = await storage.getAttendanceRequests()
  const rows = all
    .map((r) => toOpsBoardRow(r))
    .filter(Boolean)
    .filter((r) => r.opsStage !== 'closed')
    .sort((a, b) => String(b.lastOpsUpdate || '').localeCompare(String(a.lastOpsUpdate || '')))
    .slice(0, Math.min(Math.max(Number(limit) || 150, 1), 300))
  return rows
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
  markAttended,
  overrideEvidenceRequirement,
  uploadEvidence,
  getEvidenceSignedUrl,
  removeEvidence,
  setReportInProgress,
  markReportReady,
  markDelivered,
  closeRequest,
  opsStageAfterPayment,
  deriveManualOpsStage,
  normalizeOpsStage,
  EVIDENCE_MAX_BYTES,
  EVIDENCE_ALLOWED_TYPES,
}
