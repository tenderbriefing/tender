/**
 * Phase 16 — Field check-in, evidence, attendance confirmation, Ops review.
 * Does NOT touch PayFast / ITN / assignment accept-decline semantics.
 */
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { getStorage } = require('../storageAdapter')
const { getFirebaseAdmin } = require('../../config/firebaseAdmin')
const auditLogService = require('../auditLogService')
const { deriveManualOpsStage } = require('../../domain/manualBriefingOps')
const {
  FIELD_SUBSTATES,
  EVIDENCE_REVIEW_STATUS,
  evaluateCheckInWindow,
  hasConfirmedAssignee,
  evidenceCount,
  hasUsefulEvidence,
  briefingMomentSa,
} = require('../../domain/fieldExecution')

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
  'audio/wav',
  'video/mp4',
  'video/webm',
])

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token || ''), 'utf8').digest('hex')
}

function mintToken() {
  const token = crypto.randomBytes(32).toString('base64url')
  return { token, tokenHash: hashToken(token), tokenId: crypto.randomBytes(8).toString('hex') }
}

function timingSafeEqualHex(a, b) {
  try {
    return crypto.timingSafeEqual(Buffer.from(String(a), 'hex'), Buffer.from(String(b), 'hex'))
  } catch {
    return String(a) === String(b)
  }
}

async function getRequest(requestId) {
  const id = String(requestId || '').trim()
  if (!id) return null
  try {
    const db = getFirebaseAdmin().firestore()
    const snap = await db.collection('attendanceRequests').doc(id).get()
    if (snap.exists) return { id: snap.id, ...snap.data() }
  } catch {
    /* fall through */
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

function assertAssigned(request) {
  if (!hasConfirmedAssignee(request)) {
    throw new Error('Request has no confirmed representative')
  }
  if (String(request.fieldSubstate || '') === FIELD_SUBSTATES.NO_SHOW) {
    throw new Error('Assignment marked no-show — field access revoked')
  }
  const stage = deriveManualOpsStage(request)
  const allowed = new Set([
    'assigned',
    'briefing_due',
    'attended',
    'evidence_required',
    'evidence_received',
  ])
  if (!allowed.has(stage) && request.attended !== true) {
    throw new Error(`Field actions not available in stage ${stage}`)
  }
}

function verifyFieldToken(request, token) {
  const expected = String(request.fieldAccessTokenHash || '').trim()
  if (!expected || !token) return false
  return timingSafeEqualHex(expected, hashToken(token))
}

function assertFieldActor(request, actor = {}) {
  if (actor.role === 'admin') return { mode: 'admin' }
  if (actor.token && verifyFieldToken(request, actor.token)) return { mode: 'token' }
  const uid = String(actor.uid || '').trim()
  if (
    uid &&
    (uid === String(request.assignedAgentId || '') || uid === String(request.agentId || ''))
  ) {
    return { mode: 'agent' }
  }
  throw new Error('Forbidden — not the assigned representative')
}

/** Ops: mint / rotate field access link for the confirmed representative. */
async function issueFieldAccess(requestId, adminUser = {}) {
  const request = await getRequest(requestId)
  if (!request) throw new Error('Attendance request not found')
  assertAssigned(request)
  const { token, tokenHash, tokenId } = mintToken()
  request.fieldAccessTokenHash = tokenHash
  request.fieldAccessTokenId = tokenId
  request.fieldAccessIssuedAt = new Date().toISOString()
  request.fieldAccessIssuedBy = adminUser.uid || null
  const saved = await saveRequest(request)
  await auditLogService.logEvent({
    type: 'ops_field_access_issued',
    entityId: requestId,
    actorId: adminUser.uid || 'admin',
    tokenId,
  })
  return {
    request: saved,
    token,
    fieldUrl: `/assignments/field?requestId=${encodeURIComponent(requestId)}&token=${encodeURIComponent(token)}`,
  }
}

function toFieldSafeView(request, { includePayout = true } = {}) {
  if (!request) return null
  const stage = deriveManualOpsStage(request)
  return {
    requestId: request.id,
    tenderNumber: request.tenderNumber || null,
    tenderTitle: request.tenderTitle || null,
    procuringEntity: request.department || request.issuer || request.procuringEntity || null,
    briefingDate: request.briefingDate || null,
    briefingTime: request.briefingTime || null,
    briefingVenue: request.briefingVenue || null,
    province: request.province || null,
    contactPerson: request.officialContact || request.briefingContact || null,
    contactPhone: request.briefingContactPhone || null,
    assignmentInstructions: request.assignmentInstructions || null,
    representativeName: request.representativeName || request.agentName || null,
    payoutCents: includePayout ? request.agentPayoutCents || request.representativePayoutCents || null : null,
    opsStage: stage,
    fieldSubstate: request.fieldSubstate || null,
    checkedInAt: request.checkedInAt || null,
    attended: request.attended === true,
    attendedAt: request.attendedAt || null,
    evidenceCount: evidenceCount(request),
    evidenceReviewStatus: request.evidenceReviewStatus || null,
    fieldNotes: request.fieldNotes || '',
    locationCaptured: Boolean(request.checkInLocation?.lat != null),
    // Never expose raw coordinates on field preview to reduce leak surface in screenshots;
    // representative already knows they shared location. Ops sees coords separately.
  }
}

async function getFieldPreview(requestId, actor = {}) {
  const request = await getRequest(requestId)
  if (!request) return null
  assertFieldActor(request, actor)
  assertAssigned(request)
  return toFieldSafeView(request, { includePayout: true })
}

async function checkIn(requestId, actor = {}, input = {}) {
  const request = await getRequest(requestId)
  if (!request) throw new Error('Attendance request not found')
  assertFieldActor(request, actor)
  assertAssigned(request)

  const now = new Date()
  const window = evaluateCheckInWindow(request, now)
  const override = actor.role === 'admin' && input.overrideWindow === true
  if (!window.ok && !override) {
    const err = new Error(
      window.reason === 'check_in_too_early'
        ? 'Check-in is not open yet for this briefing'
        : window.reason === 'check_in_window_closed'
          ? 'Check-in window has closed'
          : 'Cannot check in — briefing date/time missing'
    )
    err.code = window.reason
    err.meta = window
    throw err
  }

  if (request.checkedInAt && request.fieldSubstate === FIELD_SUBSTATES.CHECKED_IN) {
    return { request, alreadyCheckedIn: true, window }
  }

  request.checkedInAt = now.toISOString()
  request.checkedInBy =
    actor.uid || request.assignedAgentId || request.agentId || request.representativeName || 'field'
  request.fieldSubstate = FIELD_SUBSTATES.CHECKED_IN

  const lat = input.lat != null ? Number(input.lat) : null
  const lng = input.lng != null ? Number(input.lng) : null
  const accuracy = input.accuracy != null ? Number(input.accuracy) : null
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    request.checkInLocation = {
      lat,
      lng,
      accuracy: Number.isFinite(accuracy) ? accuracy : null,
      capturedAt: now.toISOString(),
      source: 'browser_geolocation',
    }
  } else if (input.locationDenied === true) {
    request.checkInLocationDenied = true
  }

  const saved = await saveRequest(request)
  await auditLogService.logEvent({
    type: 'field_checked_in',
    entityId: requestId,
    actorId: actor.uid || 'field',
    hasLocation: Boolean(saved.checkInLocation),
    overrideWindow: Boolean(override),
  })
  return { request: saved, alreadyCheckedIn: false, window }
}

async function saveFieldNotes(requestId, actor = {}, notes = '') {
  const request = await getRequest(requestId)
  if (!request) throw new Error('Attendance request not found')
  assertFieldActor(request, actor)
  assertAssigned(request)
  request.fieldNotes = String(notes || '').slice(0, 20000)
  request.fieldNotesUpdatedAt = new Date().toISOString()
  const saved = await saveRequest(request)
  return { request: saved }
}

async function persistEvidenceBuffer(requestId, evidenceId, safeName, buffer, contentType, actor) {
  const storagePath = `ops-evidence/${requestId}/${evidenceId}-${safeName}`
  try {
    const admin = getFirebaseAdmin()
    const bucket = admin.storage().bucket()
    await bucket.file(storagePath).save(buffer, {
      metadata: {
        contentType,
        metadata: {
          uploadedBy: String(actor.uid || actor.mode || 'field'),
          requestId,
          source: 'field',
        },
      },
      resumable: false,
    })
    return { storagePath, localFallback: false }
  } catch (err) {
    // Unit/JSON adapter or GCS unavailable — preserve bytes locally without overwrite
    const dir = path.join(process.cwd(), 'backend', 'data', 'ops-evidence', requestId)
    fs.mkdirSync(dir, { recursive: true })
    const localPath = path.join(dir, `${evidenceId}-${safeName}`)
    if (fs.existsSync(localPath)) {
      throw new Error('Evidence file already exists — refusing overwrite')
    }
    fs.writeFileSync(localPath, buffer)
    return { storagePath: `local:${localPath}`, localFallback: true, error: err?.message }
  }
}

async function uploadFieldEvidence(requestId, actor = {}, file = {}) {
  const request = await getRequest(requestId)
  if (!request) throw new Error('Attendance request not found')
  assertFieldActor(request, actor)
  assertAssigned(request)

  const { buffer, fileName, contentType, category, size } = file
  const cat = String(category || 'attendance_proof').trim().toLowerCase()
  if (!buffer || !Buffer.isBuffer(buffer)) throw new Error('File buffer required')
  const bytes = size != null ? Number(size) : buffer.length
  if (bytes > EVIDENCE_MAX_BYTES) throw new Error('File exceeds 15MB limit')
  const type = String(contentType || 'application/octet-stream')
  if (!EVIDENCE_ALLOWED_TYPES.has(type)) {
    throw new Error(`Unsupported file type: ${type}`)
  }

  const safeName = String(fileName || 'evidence')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 80)
  const evidenceId = `ev-${crypto.randomBytes(6).toString('hex')}`
  const stored = await persistEvidenceBuffer(requestId, evidenceId, safeName, buffer, type, actor)

  const item = {
    id: evidenceId,
    category: cat,
    fileName: safeName,
    contentType: type,
    sizeBytes: bytes,
    storagePath: stored.storagePath,
    uploadedAt: new Date().toISOString(),
    uploadedBy: actor.uid || request.assignedAgentId || request.representativeName || 'field',
    uploadedByEmail: actor.email || null,
    source: 'field',
    assignmentId: request.assignmentDispatchId || request.id,
  }

  const items = Array.isArray(request.evidenceItems) ? [...request.evidenceItems] : []
  items.push(item)
  request.evidenceItems = items
  request.evidenceCount = items.length

  const saved = await saveRequest(request)
  await auditLogService.logEvent({
    type: 'field_evidence_uploaded',
    entityId: requestId,
    actorId: actor.uid || 'field',
    evidenceId,
    category: cat,
  })
  return { request: saved, evidence: item }
}

/**
 * Representative confirms attendance + submits evidence package.
 * Does not treat check-in alone as attendance.
 */
async function confirmAttendanceAndSubmit(requestId, actor = {}, input = {}) {
  const request = await getRequest(requestId)
  if (!request) throw new Error('Attendance request not found')
  assertFieldActor(request, actor)
  assertAssigned(request)

  if (input.notes != null) {
    request.fieldNotes = String(input.notes || '').slice(0, 20000)
    request.fieldNotesUpdatedAt = new Date().toISOString()
  }

  if (!hasUsefulEvidence(request)) {
    request.fieldSubstate = FIELD_SUBSTATES.EVIDENCE_INCOMPLETE
    const saved = await saveRequest(request)
    return {
      request: saved,
      ok: false,
      warning: 'Add photos, PDF, audio, or detailed notes before confirming attendance',
      evidenceCount: evidenceCount(saved),
    }
  }

  if (!request.checkedInAt) {
    // Soft warn — allow confirm if evidence is strong (Ops can still review)
    request.checkInSkippedAtConfirm = true
  }

  const now = new Date().toISOString()
  request.attended = true
  request.attendedAt = now
  request.attendedBy = actor.uid || request.assignedAgentId || request.representativeName || 'field'
  request.attendanceConfirmedAt = now
  request.fieldSubstate = FIELD_SUBSTATES.ATTENDANCE_SUBMITTED
  request.evidenceReviewStatus = EVIDENCE_REVIEW_STATUS.PENDING_REVIEW
  request.opsStage = 'evidence_received'

  const saved = await saveRequest(request)
  await auditLogService.logEvent({
    type: 'field_attendance_confirmed',
    entityId: requestId,
    actorId: actor.uid || 'field',
    evidenceCount: evidenceCount(saved),
  })
  return { request: saved, ok: true, warning: null, evidenceCount: evidenceCount(saved) }
}

async function approveEvidence(requestId, adminUser = {}, input = {}) {
  const request = await getRequest(requestId)
  if (!request) throw new Error('Attendance request not found')
  if (!request.attended && !request.attendedAt) {
    throw new Error('Attendance not confirmed yet')
  }
  request.evidenceReviewStatus = EVIDENCE_REVIEW_STATUS.APPROVED
  request.evidenceApprovedAt = new Date().toISOString()
  request.evidenceApprovedBy = adminUser.uid || null
  request.evidenceReviewNote = String(input.note || '').slice(0, 500) || null
  request.opsStage = 'evidence_received'
  if (request.fieldSubstate === FIELD_SUBSTATES.EVIDENCE_INCOMPLETE) {
    request.fieldSubstate = FIELD_SUBSTATES.ATTENDANCE_SUBMITTED
  }
  const saved = await saveRequest(request)
  await auditLogService.logEvent({
    type: 'ops_evidence_approved',
    entityId: requestId,
    actorId: adminUser.uid || 'admin',
  })
  return saved
}

async function requestMoreEvidence(requestId, adminUser = {}, input = {}) {
  const request = await getRequest(requestId)
  if (!request) throw new Error('Attendance request not found')
  request.evidenceReviewStatus = EVIDENCE_REVIEW_STATUS.MORE_REQUESTED
  request.evidenceMoreRequestedAt = new Date().toISOString()
  request.evidenceMoreRequestedBy = adminUser.uid || null
  request.evidenceMoreRequestNote = String(input.note || input.reason || '').slice(0, 1000)
  request.fieldSubstate = FIELD_SUBSTATES.EVIDENCE_INCOMPLETE
  // Keep attended true — they went; need more proof
  request.opsStage = 'evidence_required'
  const saved = await saveRequest(request)
  await auditLogService.logEvent({
    type: 'ops_evidence_more_requested',
    entityId: requestId,
    actorId: adminUser.uid || 'admin',
    note: request.evidenceMoreRequestNote,
  })
  return saved
}

async function markNoShow(requestId, adminUser = {}, input = {}) {
  const request = await getRequest(requestId)
  if (!request) throw new Error('Attendance request not found')
  assertAssigned(request)

  const history = Array.isArray(request.assignmentHistory) ? [...request.assignmentHistory] : []
  history.push({
    event: 'no_show',
    previousName: request.representativeName || null,
    previousAgentId: request.assignedAgentId || request.agentId || null,
    reason: String(input.reason || '').slice(0, 500) || null,
    at: new Date().toISOString(),
  })
  request.assignmentHistory = history.slice(-40)
  request.fieldSubstate = FIELD_SUBSTATES.NO_SHOW
  request.noShowAt = new Date().toISOString()
  request.noShowBy = adminUser.uid || null
  request.noShowReason = String(input.reason || '').slice(0, 500) || null
  request.fieldAccessTokenHash = null
  request.fieldAccessTokenId = null
  // Preserve representative identity for audit — do not erase
  request.noShowRepresentativeName = request.representativeName || null
  request.noShowAgentId = request.assignedAgentId || request.agentId || null
  // Return to assignment_required for reassignment when briefing still future
  const briefingAt = briefingMomentSa(request)
  const stillUseful = briefingAt && briefingAt.getTime() > Date.now() - 2 * 60 * 60 * 1000
  if (stillUseful) {
    request.representativeName = null
    request.assignedAgentId = null
    request.agentId = null
    request.agentName = null
    request.assignmentSubstate = 'reassignment_required'
    request.opsStage = 'assignment_required'
    request.status = 'pending'
    request.availableForAssignment = true
    request.attended = false
    request.attendedAt = null
    request.attendanceConfirmedAt = null
  }

  const saved = await saveRequest(request)
  await auditLogService.logEvent({
    type: 'ops_representative_no_show',
    entityId: requestId,
    actorId: adminUser.uid || 'admin',
    reason: request.noShowReason,
    reassignmentOpened: Boolean(stillUseful),
  })
  return saved
}

/** Admin override check-in window / force check-in. */
async function adminOverrideCheckIn(requestId, adminUser = {}, input = {}) {
  return checkIn(requestId, { ...adminUser, role: 'admin' }, { ...input, overrideWindow: true })
}

module.exports = {
  getRequest,
  issueFieldAccess,
  getFieldPreview,
  checkIn,
  saveFieldNotes,
  uploadFieldEvidence,
  confirmAttendanceAndSubmit,
  approveEvidence,
  requestMoreEvidence,
  markNoShow,
  adminOverrideCheckIn,
  toFieldSafeView,
  verifyFieldToken,
  FIELD_SUBSTATES,
  EVIDENCE_REVIEW_STATUS,
  EVIDENCE_MAX_BYTES,
  EVIDENCE_ALLOWED_TYPES,
}
