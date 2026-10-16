/**
 * Phase 15 — Assignment dispatch helpers (pure).
 * Canonical opsStage authority remains in manualBriefingOps; this module owns
 * assignmentSubstate + acceptance deadline + token hashing only.
 */

const crypto = require('crypto')

const ASSIGNMENT_SUBSTATES = Object.freeze({
  CANDIDATE_SELECTED: 'candidate_selected',
  DISPATCH_SENT: 'dispatch_sent',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  EXPIRED: 'expired',
  REASSIGNMENT_REQUIRED: 'reassignment_required',
})

const ACCEPTANCE_URGENCY = Object.freeze({
  NORMAL: 'NORMAL',
  URGENT: 'URGENT',
  CRITICAL: 'CRITICAL',
})

const OPS_TZ_OFFSET = '+02:00'
const HOUR = 60 * 60 * 1000

function briefingMomentSa(request) {
  const dateRaw = String(request.briefingDate || '').trim()
  if (!dateRaw) return null
  const timeMatch = String(request.briefingTime || '12:00').trim().match(/^(\d{1,2}):(\d{2})/)
  const hh = timeMatch ? String(timeMatch[1]).padStart(2, '0') : '12'
  const mm = timeMatch ? timeMatch[2] : '00'
  const datePart = dateRaw.includes('T') ? dateRaw.slice(0, 10) : dateRaw
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null
  const d = new Date(`${datePart}T${hh}:${mm}:00${OPS_TZ_OFFSET}`)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Deadline relative to briefing urgency (Africa/Johannesburg moments).
 * CRITICAL (<6h): min(2h, untilBriefing - 30m)
 * URGENT (<24h): 4h
 * NORMAL: 12h
 * Always capped so deadline is before briefing when possible.
 */
function computeAcceptanceDeadline(request = {}, now = new Date()) {
  const briefingAt = briefingMomentSa(request)
  const nowMs = now.getTime()
  let urgency = ACCEPTANCE_URGENCY.NORMAL
  let windowMs = 12 * HOUR

  if (briefingAt) {
    const until = briefingAt.getTime() - nowMs
    if (until <= 6 * HOUR) {
      urgency = ACCEPTANCE_URGENCY.CRITICAL
      windowMs = Math.min(2 * HOUR, Math.max(15 * 60 * 1000, until - 30 * 60 * 1000))
    } else if (until <= 24 * HOUR) {
      urgency = ACCEPTANCE_URGENCY.URGENT
      windowMs = 4 * HOUR
    }
  }

  let deadlineMs = nowMs + Math.max(15 * 60 * 1000, windowMs)
  if (briefingAt && deadlineMs >= briefingAt.getTime()) {
    deadlineMs = Math.max(nowMs + 5 * 60 * 1000, briefingAt.getTime() - 15 * 60 * 1000)
  }

  return {
    urgency,
    deadlineAt: new Date(deadlineMs).toISOString(),
    briefingAt: briefingAt ? briefingAt.toISOString() : null,
  }
}

function normalizeAssignmentSubstate(raw) {
  const key = String(raw || '')
    .trim()
    .toLowerCase()
  return Object.values(ASSIGNMENT_SUBSTATES).includes(key) ? key : null
}

/** Confirmed assignee — pending dispatch does not count. */
function hasConfirmedRepresentative(request = {}) {
  const sub = normalizeAssignmentSubstate(request.assignmentSubstate)
  if (
    sub === ASSIGNMENT_SUBSTATES.DISPATCH_SENT ||
    sub === ASSIGNMENT_SUBSTATES.CANDIDATE_SELECTED ||
    sub === ASSIGNMENT_SUBSTATES.DECLINED ||
    sub === ASSIGNMENT_SUBSTATES.EXPIRED ||
    sub === ASSIGNMENT_SUBSTATES.REASSIGNMENT_REQUIRED
  ) {
    return false
  }
  return Boolean(
    request.assignedAgentId ||
      request.agentId ||
      String(request.representativeName || '').trim()
  )
}

function isDispatchPending(request = {}) {
  const sub = normalizeAssignmentSubstate(request.assignmentSubstate)
  return (
    sub === ASSIGNMENT_SUBSTATES.DISPATCH_SENT ||
    sub === ASSIGNMENT_SUBSTATES.CANDIDATE_SELECTED ||
    String(request.opsStage || '').toLowerCase() === 'assignment_pending'
  )
}

function isAcceptanceExpired(request = {}, now = new Date()) {
  if (!isDispatchPending(request)) return false
  const raw = request.assignmentAcceptanceDeadlineAt
  if (!raw) return false
  const t = new Date(raw).getTime()
  if (Number.isNaN(t)) return false
  return now.getTime() >= t
}

function hashDispatchToken(token) {
  return crypto.createHash('sha256').update(String(token || ''), 'utf8').digest('hex')
}

function mintDispatchToken() {
  const token = crypto.randomBytes(32).toString('base64url')
  return { token, tokenHash: hashDispatchToken(token), tokenId: crypto.randomBytes(8).toString('hex') }
}

function verifyDispatchToken(request, token) {
  const expected = String(request.assignmentDispatchTokenHash || '').trim()
  if (!expected || !token) return false
  const actual = hashDispatchToken(token)
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(actual, 'hex'))
  } catch {
    return expected === actual
  }
}

module.exports = {
  ASSIGNMENT_SUBSTATES,
  ACCEPTANCE_URGENCY,
  briefingMomentSa,
  computeAcceptanceDeadline,
  normalizeAssignmentSubstate,
  hasConfirmedRepresentative,
  isDispatchPending,
  isAcceptanceExpired,
  hashDispatchToken,
  mintDispatchToken,
  verifyDispatchToken,
}
