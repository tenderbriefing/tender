/**
 * Phase 15 — Controlled representative dispatch + accept/decline.
 * Does NOT touch PayFast / processPayfastItn / markRequestPaid settlement.
 */
const { getStorage } = require('../storageAdapter')
const { getFirebaseAdmin } = require('../../config/firebaseAdmin')
const auditLogService = require('../auditLogService')
const {
  deriveManualOpsStage,
  clampAgentPayoutCents,
  SUGGESTED_AGENT_PAYOUT_CENTS,
} = require('../../domain/manualBriefingOps')
const {
  ASSIGNMENT_SUBSTATES,
  computeAcceptanceDeadline,
  hasConfirmedRepresentative,
  isDispatchPending,
  isAcceptanceExpired,
  mintDispatchToken,
  verifyDispatchToken,
  normalizeAssignmentSubstate,
} = require('../../domain/assignmentDispatch')

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

function assertPaid(request) {
  const payment = String(request.paymentStatus || '').toLowerCase()
  if (payment !== 'paid' && payment !== 'not_required') {
    throw new Error('Request must be paid before dispatch')
  }
}

function pushAssignmentHistory(request, entry) {
  const history = Array.isArray(request.assignmentHistory) ? [...request.assignmentHistory] : []
  history.push({
    ...entry,
    at: entry.at || new Date().toISOString(),
  })
  // Cap history to avoid unbounded growth
  request.assignmentHistory = history.slice(-40)
}

function clearActiveDispatchToken(request) {
  request.assignmentDispatchTokenHash = null
  request.assignmentDispatchTokenId = null
}

/**
 * Ops: select candidate + dispatch for acceptance (idempotent per open dispatch).
 * Does NOT stamp assigned — representative must accept (or Ops force-assign separately).
 */
async function dispatchRepresentative(requestId, input = {}, adminUser = {}) {
  const request = await getRequest(requestId)
  if (!request) throw new Error('Attendance request not found')
  assertPaid(request)

  if (hasConfirmedRepresentative(request) && normalizeAssignmentSubstate(request.assignmentSubstate) === ASSIGNMENT_SUBSTATES.ACCEPTED) {
    throw new Error('Request already has an accepted representative — reassign after clearing')
  }

  const name = String(input.representativeName || input.name || '').trim()
  const phone = String(input.representativePhone || input.phone || '').trim()
  const email = String(input.representativeEmail || input.email || '').trim().toLowerCase()
  const agentId = String(input.assignedAgentId || input.agentId || '').trim() || null
  const notes = String(input.internalNotes || input.notes || '').trim()
  const instructions = String(input.assignmentInstructions || input.instructions || '').trim()

  if (!name) throw new Error('Representative name is required')
  if (!email) throw new Error('Representative email is required for dispatch')

  let payout = clampAgentPayoutCents(
    input.agentPayoutCents != null ? input.agentPayoutCents : input.payoutCents
  )
  if (payout == null && input.agentPayoutCents == null && input.payoutCents == null) {
    payout = SUGGESTED_AGENT_PAYOUT_CENTS
  }
  if (payout == null) {
    throw new Error('Payout must be between R100.00 and R600.00')
  }

  // Idempotent re-click: same candidate + open dispatch → reuse, no new email blast key
  const existingSub = normalizeAssignmentSubstate(request.assignmentSubstate)
  const sameCandidate =
    isDispatchPending(request) &&
    String(request.assignmentCandidateEmail || '').toLowerCase() === email &&
    String(request.assignmentCandidateName || '').trim() === name &&
    Number(request.agentPayoutCents) === payout

  if (sameCandidate && existingSub === ASSIGNMENT_SUBSTATES.DISPATCH_SENT && request.assignmentDispatchTokenHash) {
    return {
      request,
      alreadyDispatched: true,
      dispatchId: request.assignmentDispatchId || null,
      acceptanceDeadlineAt: request.assignmentAcceptanceDeadlineAt || null,
      emailSent: false,
    }
  }

  // Preserve prior candidate on reassignment
  if (
    request.assignmentCandidateName ||
    request.representativeName ||
    request.assignedAgentId
  ) {
    pushAssignmentHistory(request, {
      event: 'reassigned',
      previousName: request.assignmentCandidateName || request.representativeName || null,
      previousAgentId: request.assignmentCandidateAgentId || request.assignedAgentId || request.agentId || null,
      previousEmail: request.assignmentCandidateEmail || null,
      reason: input.reassignReason || 'ops_redispatch',
    })
  }

  const now = new Date()
  const deadline = computeAcceptanceDeadline(request, now)
  const { token, tokenHash, tokenId } = mintDispatchToken()
  const dispatchId = `disp-${Date.now().toString(36)}-${tokenId}`

  // Candidate only — do not set confirmed representativeName until accept
  request.assignmentCandidateName = name
  request.assignmentCandidatePhone = phone || null
  request.assignmentCandidateEmail = email
  request.assignmentCandidateAgentId = agentId
  request.assignmentSubstate = ASSIGNMENT_SUBSTATES.DISPATCH_SENT
  request.assignmentDispatchedAt = now.toISOString()
  request.assignmentDispatchedBy = adminUser.uid || null
  request.assignmentDispatchedByEmail = adminUser.email || null
  request.assignmentAcceptanceDeadlineAt = deadline.deadlineAt
  request.assignmentAcceptanceUrgency = deadline.urgency
  request.assignmentDispatchTokenHash = tokenHash
  request.assignmentDispatchTokenId = tokenId
  request.assignmentDispatchId = dispatchId
  request.assignmentInstructions = instructions || null
  request.representativeInternalNotes = notes || request.representativeInternalNotes || null
  request.agentPayoutCents = payout
  request.representativePayoutCents = payout
  request.assignmentDeclinedAt = null
  request.assignmentDeclineReason = null
  request.assignmentExpiredAt = null
  // Clear prior confirmed assignee while pending
  request.representativeName = null
  request.representativePhone = null
  request.assignedAgentId = null
  request.agentId = null
  request.agentName = null
  request.acceptedAt = null
  request.manualRepresentative = false
  request.opsStage = 'assignment_pending'
  request.status = request.status === 'assigned' ? 'pending' : request.status || 'pending'
  request.availableForAssignment = false

  pushAssignmentHistory(request, {
    event: 'dispatch_sent',
    selectedBy: adminUser.uid || null,
    selectedByEmail: adminUser.email || null,
    candidateName: name,
    candidateEmail: email,
    candidateAgentId: agentId,
    payoutCents: payout,
    acceptanceDeadlineAt: deadline.deadlineAt,
    urgency: deadline.urgency,
    dispatchId,
  })

  const saved = await saveRequest(request)

  let emailResult = { sent: false, skipped: true }
  try {
    const tx = require('../../../lib/services/transactionalEmailService')
    emailResult = await tx.sendAssignmentDispatchEmailSafe(saved, {
      token,
      dispatchId,
      payoutCents: payout,
      deadlineAt: deadline.deadlineAt,
      urgency: deadline.urgency,
      instructions: instructions || null,
      name,
      email,
    })
  } catch (err) {
    console.warn('[assignmentDispatch] email failed:', err?.message || err)
  }

  await auditLogService.logEvent({
    type: 'ops_assignment_dispatched',
    entityId: requestId,
    actorId: adminUser.uid || 'admin',
    actorEmail: adminUser.email || null,
    candidateName: name,
    candidateEmail: email,
    payoutCents: payout,
    dispatchId,
    acceptanceDeadlineAt: deadline.deadlineAt,
    urgency: deadline.urgency,
  })

  return {
    request: saved,
    alreadyDispatched: false,
    dispatchId,
    acceptanceDeadlineAt: deadline.deadlineAt,
    urgency: deadline.urgency,
    emailSent: Boolean(emailResult?.sent),
    // Token returned only to admin caller for cert/testing — never to customer APIs
    _testToken: process.env.NODE_ENV === 'test' ? token : undefined,
  }
}

/**
 * Expire an open dispatch when deadline passed (canonical timestamps).
 */
async function expireDispatchIfNeeded(requestId, now = new Date()) {
  const request = await getRequest(requestId)
  if (!request) return null
  if (!isDispatchPending(request)) return request
  if (!isAcceptanceExpired(request, now)) return request

  pushAssignmentHistory(request, {
    event: 'expired',
    previousName: request.assignmentCandidateName || null,
    previousEmail: request.assignmentCandidateEmail || null,
    previousAgentId: request.assignmentCandidateAgentId || null,
    deadlineAt: request.assignmentAcceptanceDeadlineAt,
  })

  request.assignmentSubstate = ASSIGNMENT_SUBSTATES.REASSIGNMENT_REQUIRED
  request.assignmentExpiredAt = now.toISOString()
  clearActiveDispatchToken(request)
  request.opsStage = 'assignment_required'
  request.availableForAssignment = true

  const saved = await saveRequest(request)
  await auditLogService.logEvent({
    type: 'ops_assignment_expired',
    entityId: requestId,
    actorId: 'system',
    deadlineAt: request.assignmentAcceptanceDeadlineAt,
  })
  return saved
}

async function acceptDispatch(requestId, { token } = {}) {
  let request = await getRequest(requestId)
  if (!request) throw new Error('Attendance request not found')

  request = (await expireDispatchIfNeeded(requestId)) || request
  // Reload after possible expire
  request = (await getRequest(requestId)) || request

  if (normalizeAssignmentSubstate(request.assignmentSubstate) === ASSIGNMENT_SUBSTATES.ACCEPTED) {
    return { request, alreadyAccepted: true }
  }

  if (!isDispatchPending(request)) {
    throw new Error('No active dispatch to accept')
  }
  if (isAcceptanceExpired(request)) {
    await expireDispatchIfNeeded(requestId)
    throw new Error('Acceptance deadline has expired')
  }
  if (!verifyDispatchToken(request, token)) {
    throw new Error('Invalid or expired acceptance token')
  }

  const now = new Date().toISOString()
  const name = request.assignmentCandidateName
  const phone = request.assignmentCandidatePhone
  const email = request.assignmentCandidateEmail
  const agentId = request.assignmentCandidateAgentId

  request.representativeName = name
  request.representativePhone = phone
  request.agentName = name
  if (agentId) {
    request.assignedAgentId = agentId
    request.agentId = agentId
    request.manualRepresentative = false
  } else {
    request.manualRepresentative = true
  }
  request.assignmentSubstate = ASSIGNMENT_SUBSTATES.ACCEPTED
  request.assignmentAcceptedAt = now
  request.acceptedAt = now
  request.representativeAssignedAt = now
  request.opsStage = 'assigned'
  request.status = 'assigned'
  request.availableForAssignment = false
  clearActiveDispatchToken(request)

  pushAssignmentHistory(request, {
    event: 'accepted',
    candidateName: name,
    candidateEmail: email,
    candidateAgentId: agentId,
  })

  const saved = await saveRequest(request)
  await auditLogService.logEvent({
    type: 'ops_assignment_accepted',
    entityId: requestId,
    actorId: agentId || 'token',
    representativeName: name,
    dispatchId: request.assignmentDispatchId || null,
  })

  // Customer-safe “representative confirmed” via existing allocated email — fail-soft
  try {
    const tx = require('../../../lib/services/transactionalEmailService')
    if (saved.smeEmail) {
      await tx.sendAgentAllocatedToSmeEmailSafe(saved)
    }
  } catch {
    /* ignore */
  }

  return { request: saved, alreadyAccepted: false }
}

async function declineDispatch(requestId, { token, reason } = {}) {
  let request = await getRequest(requestId)
  if (!request) throw new Error('Attendance request not found')

  if (normalizeAssignmentSubstate(request.assignmentSubstate) === ASSIGNMENT_SUBSTATES.ACCEPTED) {
    throw new Error('Assignment already accepted — cannot decline')
  }
  if (normalizeAssignmentSubstate(request.assignmentSubstate) === ASSIGNMENT_SUBSTATES.DECLINED) {
    return { request, alreadyDeclined: true }
  }
  if (
    normalizeAssignmentSubstate(request.assignmentSubstate) ===
      ASSIGNMENT_SUBSTATES.REASSIGNMENT_REQUIRED &&
    request.assignmentDeclinedAt
  ) {
    return { request, alreadyDeclined: true }
  }

  if (!isDispatchPending(request) && !isAcceptanceExpired(request)) {
    throw new Error('No active dispatch to decline')
  }
  if (!verifyDispatchToken(request, token)) {
    throw new Error('Invalid or expired acceptance token')
  }

  const now = new Date().toISOString()
  const declineReason = String(reason || '').trim().slice(0, 500) || null

  pushAssignmentHistory(request, {
    event: 'declined',
    previousName: request.assignmentCandidateName || null,
    previousEmail: request.assignmentCandidateEmail || null,
    previousAgentId: request.assignmentCandidateAgentId || null,
    reason: declineReason,
  })

  request.assignmentSubstate = ASSIGNMENT_SUBSTATES.REASSIGNMENT_REQUIRED
  request.assignmentDeclinedAt = now
  request.assignmentDeclineReason = declineReason
  clearActiveDispatchToken(request)
  request.opsStage = 'assignment_required'
  request.availableForAssignment = true
  request.representativeName = null
  request.assignedAgentId = null
  request.agentId = null
  request.agentName = null

  const saved = await saveRequest(request)
  await auditLogService.logEvent({
    type: 'ops_assignment_declined',
    entityId: requestId,
    actorId: 'token',
    reason: declineReason,
    dispatchId: request.assignmentDispatchId || null,
  })

  return { request: saved, alreadyDeclined: false }
}

/**
 * Load a safe public view for the respond page (no payout to unauthenticated beyond what's needed for the agent's decision — payout IS shown to the dispatched recipient after token verify).
 */
async function getDispatchPreview(requestId, token) {
  const request = await getRequest(requestId)
  if (!request) return null
  if (!verifyDispatchToken(request, token)) return null
  await expireDispatchIfNeeded(requestId)
  const fresh = (await getRequest(requestId)) || request
  if (!verifyDispatchToken(fresh, token) && normalizeAssignmentSubstate(fresh.assignmentSubstate) !== ASSIGNMENT_SUBSTATES.ACCEPTED) {
    // Token cleared after accept/decline/expire — still allow read-only status
  }
  const pending = isDispatchPending(fresh) && verifyDispatchToken(fresh, token)
  return {
    requestId: fresh.id,
    tenderNumber: fresh.tenderNumber || null,
    tenderTitle: fresh.tenderTitle || null,
    briefingDate: fresh.briefingDate || null,
    briefingTime: fresh.briefingTime || null,
    briefingVenue: fresh.briefingVenue || null,
    province: fresh.province || null,
    instructions: fresh.assignmentInstructions || null,
    candidateName: fresh.assignmentCandidateName || null,
    payoutCents: pending ? fresh.agentPayoutCents || fresh.representativePayoutCents || null : null,
    acceptanceDeadlineAt: fresh.assignmentAcceptanceDeadlineAt || null,
    urgency: fresh.assignmentAcceptanceUrgency || null,
    assignmentSubstate: fresh.assignmentSubstate || null,
    opsStage: deriveManualOpsStage(fresh),
    canRespond: pending && !isAcceptanceExpired(fresh),
    expired: isAcceptanceExpired(fresh) || normalizeAssignmentSubstate(fresh.assignmentSubstate) === ASSIGNMENT_SUBSTATES.REASSIGNMENT_REQUIRED,
  }
}

module.exports = {
  getRequest,
  dispatchRepresentative,
  acceptDispatch,
  declineDispatch,
  expireDispatchIfNeeded,
  getDispatchPreview,
  ASSIGNMENT_SUBSTATES,
}
