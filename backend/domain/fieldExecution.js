/**
 * Phase 16 — Field execution helpers (pure).
 * Check-in window + field substates. Timezone: Africa/Johannesburg.
 */

const OPS_TZ_OFFSET = '+02:00'
const HOUR = 60 * 60 * 1000

/** Configurable check-in window around briefing (env overrides). */
function getCheckInWindowMs(env = process.env) {
  const beforeH = Number(env.FIELD_CHECKIN_BEFORE_HOURS || 2)
  const afterH = Number(env.FIELD_CHECKIN_AFTER_HOURS || 4)
  return {
    beforeMs: (Number.isFinite(beforeH) ? Math.max(0, beforeH) : 2) * HOUR,
    afterMs: (Number.isFinite(afterH) ? Math.max(0, afterH) : 4) * HOUR,
  }
}

const FIELD_SUBSTATES = Object.freeze({
  CHECKED_IN: 'checked_in',
  ATTENDANCE_SUBMITTED: 'attendance_submitted',
  EVIDENCE_INCOMPLETE: 'evidence_incomplete',
  NO_SHOW: 'no_show',
})

const EVIDENCE_REVIEW_STATUS = Object.freeze({
  PENDING_REVIEW: 'pending_review',
  APPROVED: 'approved',
  MORE_REQUESTED: 'more_requested',
  OVERRIDDEN: 'overridden',
})

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
 * @returns {{ ok: boolean, reason?: string, briefingAt?: string, window?: object }}
 */
function evaluateCheckInWindow(request = {}, now = new Date(), env = process.env) {
  const briefingAt = briefingMomentSa(request)
  if (!briefingAt) {
    return { ok: false, reason: 'briefing_datetime_missing' }
  }
  const { beforeMs, afterMs } = getCheckInWindowMs(env)
  const t = now.getTime()
  const start = briefingAt.getTime() - beforeMs
  const end = briefingAt.getTime() + afterMs
  if (t < start) {
    return {
      ok: false,
      reason: 'check_in_too_early',
      briefingAt: briefingAt.toISOString(),
      window: { opensAt: new Date(start).toISOString(), closesAt: new Date(end).toISOString() },
    }
  }
  if (t > end) {
    return {
      ok: false,
      reason: 'check_in_window_closed',
      briefingAt: briefingAt.toISOString(),
      window: { opensAt: new Date(start).toISOString(), closesAt: new Date(end).toISOString() },
    }
  }
  return {
    ok: true,
    briefingAt: briefingAt.toISOString(),
    window: { opensAt: new Date(start).toISOString(), closesAt: new Date(end).toISOString() },
  }
}

function hasConfirmedAssignee(request = {}) {
  return Boolean(
    request.assignedAgentId ||
      request.agentId ||
      String(request.representativeName || '').trim()
  )
}

function evidenceCount(request = {}) {
  if (Number.isFinite(Number(request.evidenceCount))) {
    return Math.max(0, Number(request.evidenceCount))
  }
  return Array.isArray(request.evidenceItems) ? request.evidenceItems.length : 0
}

function hasUsefulEvidence(request = {}) {
  if (request.evidenceOverride === true) return true
  const n = evidenceCount(request)
  if (n <= 0) return false
  const notes = String(request.fieldNotes || '').trim()
  // At least one evidence item OR substantial notes with a photo/doc category
  if (n >= 1) return true
  return notes.length >= 40
}

module.exports = {
  OPS_TZ_OFFSET,
  FIELD_SUBSTATES,
  EVIDENCE_REVIEW_STATUS,
  getCheckInWindowMs,
  briefingMomentSa,
  evaluateCheckInWindow,
  hasConfirmedAssignee,
  evidenceCount,
  hasUsefulEvidence,
}
