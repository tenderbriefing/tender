/**
 * Phase 13 — Operational SLA / exception engine (derived, timezone-safe).
 * Africa/Johannesburg (+02:00, no DST) for briefing moments.
 */
const { deriveManualOpsStage, nextRequiredAction } = require('./manualBriefingOps')

const OPS_TZ = 'Africa/Johannesburg'
const OPS_TZ_OFFSET = '+02:00'

const SLA_TRACK = Object.freeze({
  ON_TRACK: 'ON_TRACK',
  DUE_SOON: 'DUE_SOON',
  OVERDUE: 'OVERDUE',
  BLOCKED: 'BLOCKED',
})

const EXCEPTION_CODES = Object.freeze({
  UNASSIGNED_APPROACHING_BRIEFING: 'UNASSIGNED_APPROACHING_BRIEFING',
  REPRESENTATIVE_RESPONSE_PENDING: 'REPRESENTATIVE_RESPONSE_PENDING',
  REPRESENTATIVE_DECLINED: 'REPRESENTATIVE_DECLINED',
  REPRESENTATIVE_RESPONSE_OVERDUE: 'REPRESENTATIVE_RESPONSE_OVERDUE',
  REPRESENTATIVE_NOT_CHECKED_IN: 'REPRESENTATIVE_NOT_CHECKED_IN',
  BRIEFING_STARTED_NO_CHECKIN: 'BRIEFING_STARTED_NO_CHECKIN',
  BRIEFING_PASSED_NO_ATTENDANCE_CONFIRMATION: 'BRIEFING_PASSED_NO_ATTENDANCE_CONFIRMATION',
  ATTENDED_NO_EVIDENCE: 'ATTENDED_NO_EVIDENCE',
  EVIDENCE_INCOMPLETE: 'EVIDENCE_INCOMPLETE',
  BRIEFING_PASSED_NO_EVIDENCE: 'BRIEFING_PASSED_NO_EVIDENCE',
  EVIDENCE_RECEIVED_REPORT_PENDING: 'EVIDENCE_RECEIVED_REPORT_PENDING',
  REPORT_READY_NOT_SENT: 'REPORT_READY_NOT_SENT',
  DELIVERY_FAILED: 'DELIVERY_FAILED',
  DELIVERY_BOUNCED: 'DELIVERY_BOUNCED',
  STUCK_LIFECYCLE: 'STUCK_LIFECYCLE',
})

const EXCEPTION_LABELS = Object.freeze({
  UNASSIGNED_APPROACHING_BRIEFING: 'Unassigned — briefing approaching',
  REPRESENTATIVE_RESPONSE_PENDING: 'Awaiting representative acceptance',
  REPRESENTATIVE_DECLINED: 'Representative declined — reassign',
  REPRESENTATIVE_RESPONSE_OVERDUE: 'Acceptance overdue — reassign',
  REPRESENTATIVE_NOT_CHECKED_IN: 'Representative not checked in',
  BRIEFING_STARTED_NO_CHECKIN: 'Briefing started — no check-in',
  BRIEFING_PASSED_NO_ATTENDANCE_CONFIRMATION: 'Briefing passed — no attendance confirmation',
  ATTENDED_NO_EVIDENCE: 'Attended — no evidence',
  EVIDENCE_INCOMPLETE: 'Evidence incomplete — more required',
  BRIEFING_PASSED_NO_EVIDENCE: 'Briefing passed — no evidence',
  EVIDENCE_RECEIVED_REPORT_PENDING: 'Evidence received — report pending',
  REPORT_READY_NOT_SENT: 'Report ready — not sent',
  DELIVERY_FAILED: 'Delivery failed',
  DELIVERY_BOUNCED: 'Delivery bounced',
  STUCK_LIFECYCLE: 'Stuck lifecycle',
})

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

/** Thresholds (ms) — tunable constants for tests. */
const THRESHOLDS = Object.freeze({
  ASSIGNMENT_APPROACHING_MS: 48 * HOUR,
  ASSIGNMENT_OVERDUE_AFTER_BRIEFING_MS: 0,
  EVIDENCE_OVERDUE_AFTER_BRIEFING_MS: 0,
  REPORT_PENDING_MS: 24 * HOUR,
  REPORT_READY_OVERDUE_MS: 12 * HOUR,
  DELIVERY_REVIEW_ABANDONED_MS: 24 * HOUR,
  REOPEN_STUCK_MS: 48 * HOUR,
  DUE_SOON_MS: 24 * HOUR,
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

function ageMs(fromIso, now) {
  if (!fromIso) return null
  const t = new Date(fromIso).getTime()
  if (Number.isNaN(t)) return null
  return Math.max(0, now.getTime() - t)
}

function formatDuration(ms) {
  if (ms == null) return null
  const h = Math.floor(ms / HOUR)
  if (h < 48) return `${h}h`
  const d = Math.floor(h / 24)
  return `${d}d ${h % 24}h`
}

function recommendedActionForException(code, stage) {
  switch (code) {
    case EXCEPTION_CODES.UNASSIGNED_APPROACHING_BRIEFING:
      return { label: 'Dispatch representative', hrefAction: 'dispatch' }
    case EXCEPTION_CODES.REPRESENTATIVE_RESPONSE_PENDING:
      return { label: 'Monitor acceptance / reassign', hrefAction: 'dispatch' }
    case EXCEPTION_CODES.REPRESENTATIVE_DECLINED:
    case EXCEPTION_CODES.REPRESENTATIVE_RESPONSE_OVERDUE:
      return { label: 'Dispatch replacement', hrefAction: 'dispatch' }
    case EXCEPTION_CODES.REPRESENTATIVE_NOT_CHECKED_IN:
    case EXCEPTION_CODES.BRIEFING_STARTED_NO_CHECKIN:
      return { label: 'Follow up check-in / override', hrefAction: 'field' }
    case EXCEPTION_CODES.BRIEFING_PASSED_NO_ATTENDANCE_CONFIRMATION:
      return { label: 'Confirm attendance or mark no-show', hrefAction: 'attend' }
    case EXCEPTION_CODES.ATTENDED_NO_EVIDENCE:
    case EXCEPTION_CODES.EVIDENCE_INCOMPLETE:
    case EXCEPTION_CODES.BRIEFING_PASSED_NO_EVIDENCE:
      return { label: 'Upload evidence / mark attended', hrefAction: 'evidence' }
    case EXCEPTION_CODES.EVIDENCE_RECEIVED_REPORT_PENDING:
      return stage === 'report_in_progress'
        ? { label: 'Continue report', hrefPath: 'report' }
        : { label: 'Generate report', hrefPath: 'report' }
    case EXCEPTION_CODES.REPORT_READY_NOT_SENT:
      return { label: 'Send to client', hrefPath: 'delivery' }
    case EXCEPTION_CODES.DELIVERY_FAILED:
      return { label: 'Retry delivery', hrefPath: 'delivery' }
    case EXCEPTION_CODES.DELIVERY_BOUNCED:
      return { label: 'Fix recipient / resend', hrefPath: 'delivery' }
    case EXCEPTION_CODES.STUCK_LIFECYCLE:
      return { label: 'Inspect record', hrefAction: 'inspect' }
    default:
      return { label: nextRequiredAction(stage), hrefAction: 'inspect' }
  }
}

/**
 * Derive SLA track + primary exception (if any) for one request.
 * Pure / deterministic — no persistence.
 */
function evaluateOpsSla(request = {}, opts = {}) {
  const now = opts.now instanceof Date ? opts.now : new Date()
  const thresholds = { ...THRESHOLDS, ...(opts.thresholds || {}) }
  const stage = deriveManualOpsStage({ ...request, now })
  const briefingAt = briefingMomentSa(request)
  const deliveryStatus = String(request.clientDeliveryStatus || '').toLowerCase()
  const paid =
    String(request.paymentStatus || '').toLowerCase() === 'paid' ||
    String(request.paymentStatus || '').toLowerCase() === 'not_required'

  if (stage === 'closed' || stage === 'completed') {
    return {
      stage,
      track: SLA_TRACK.ON_TRACK,
      exceptionCode: null,
      exceptionLabel: null,
      overdueMs: null,
      overdueLabel: null,
      briefingAt: briefingAt ? briefingAt.toISOString() : null,
      timeZone: OPS_TZ,
      expectedAction: nextRequiredAction(stage),
      recommendedAction: null,
      boardFilter: stage === 'completed' ? 'completed' : 'completed',
    }
  }

  const exceptions = []

  // Delivery terminal issues — highest urgency
  if (deliveryStatus === 'bounced') {
    exceptions.push({
      code: EXCEPTION_CODES.DELIVERY_BOUNCED,
      overdueMs: ageMs(request.clientDeliveryUpdatedAt || request.deliveredAt, now) || 0,
    })
  } else if (deliveryStatus === 'failed') {
    exceptions.push({
      code: EXCEPTION_CODES.DELIVERY_FAILED,
      overdueMs: ageMs(request.clientDeliveryUpdatedAt || request.updatedAt, now) || 0,
    })
  }

  const sub = String(request.assignmentSubstate || '')
    .trim()
    .toLowerCase()

  // Phase 15 assignment exceptions (before generic unassigned approaching)
  if (paid && (stage === 'assignment_pending' || sub === 'dispatch_sent' || sub === 'candidate_selected')) {
    const deadlineRaw = request.assignmentAcceptanceDeadlineAt
    const deadlineMs = deadlineRaw ? new Date(deadlineRaw).getTime() : NaN
    if (Number.isFinite(deadlineMs) && now.getTime() >= deadlineMs) {
      exceptions.push({
        code: EXCEPTION_CODES.REPRESENTATIVE_RESPONSE_OVERDUE,
        overdueMs: now.getTime() - deadlineMs,
      })
    } else {
      exceptions.push({
        code: EXCEPTION_CODES.REPRESENTATIVE_RESPONSE_PENDING,
        overdueMs: Number.isFinite(deadlineMs) ? Math.max(0, deadlineMs - now.getTime()) : 0,
        dueSoon: true,
      })
    }
  }

  if (
    paid &&
    (sub === 'declined' ||
      sub === 'reassignment_required' ||
      (stage === 'assignment_required' && request.assignmentDeclinedAt))
  ) {
    if (sub === 'declined' || request.assignmentDeclinedAt) {
      exceptions.push({
        code: EXCEPTION_CODES.REPRESENTATIVE_DECLINED,
        overdueMs: ageMs(request.assignmentDeclinedAt || request.opsUpdatedAt, now) || 0,
      })
    } else if (sub === 'reassignment_required' || request.assignmentExpiredAt) {
      exceptions.push({
        code: EXCEPTION_CODES.REPRESENTATIVE_RESPONSE_OVERDUE,
        overdueMs: ageMs(request.assignmentExpiredAt || request.opsUpdatedAt, now) || 0,
      })
    }
  }

  if (
    paid &&
    (stage === 'assignment_required' || stage === 'assignment_pending') &&
    briefingAt
  ) {
    const untilBriefing = briefingAt.getTime() - now.getTime()
    if (untilBriefing <= thresholds.ASSIGNMENT_APPROACHING_MS) {
      exceptions.push({
        code: EXCEPTION_CODES.UNASSIGNED_APPROACHING_BRIEFING,
        overdueMs: untilBriefing < 0 ? -untilBriefing : 0,
        dueSoon: untilBriefing > 0,
      })
    }
  }

  const hasRep =
    Boolean(request.assignedAgentId || request.agentId || String(request.representativeName || '').trim()) &&
    String(request.fieldSubstate || '') !== 'no_show'
  const checkedIn = Boolean(request.checkedInAt)
  const attendanceConfirmed = request.attended === true || Boolean(request.attendanceConfirmedAt)
  const evidenceN = Array.isArray(request.evidenceItems) ? request.evidenceItems.length : 0
  const review = String(request.evidenceReviewStatus || '').toLowerCase()

  // Phase 16 field exceptions (deduped vs BRIEFING_PASSED_NO_EVIDENCE)
  if (
    paid &&
    hasRep &&
    (stage === 'assigned' || stage === 'briefing_due') &&
    briefingAt &&
    !checkedIn &&
    !attendanceConfirmed
  ) {
    const until = briefingAt.getTime() - now.getTime()
    if (until <= 2 * HOUR && until > 0) {
      exceptions.push({
        code: EXCEPTION_CODES.REPRESENTATIVE_NOT_CHECKED_IN,
        overdueMs: 0,
        dueSoon: true,
      })
    } else if (until <= 0 && until > -4 * HOUR) {
      exceptions.push({
        code: EXCEPTION_CODES.BRIEFING_STARTED_NO_CHECKIN,
        overdueMs: -until,
      })
    } else if (until <= -4 * HOUR) {
      exceptions.push({
        code: EXCEPTION_CODES.BRIEFING_PASSED_NO_ATTENDANCE_CONFIRMATION,
        overdueMs: -until,
      })
    }
  }

  if (
    paid &&
    hasRep &&
    checkedIn &&
    !attendanceConfirmed &&
    briefingAt &&
    briefingAt.getTime() < now.getTime()
  ) {
    exceptions.push({
      code: EXCEPTION_CODES.BRIEFING_PASSED_NO_ATTENDANCE_CONFIRMATION,
      overdueMs: now.getTime() - briefingAt.getTime(),
    })
  }

  if (review === 'more_requested' || String(request.fieldSubstate || '') === 'evidence_incomplete') {
    exceptions.push({
      code: EXCEPTION_CODES.EVIDENCE_INCOMPLETE,
      overdueMs: ageMs(request.evidenceMoreRequestedAt || request.opsUpdatedAt, now) || 0,
    })
  }

  if (
    attendanceConfirmed &&
    evidenceN <= 0 &&
    request.evidenceOverride !== true &&
    (stage === 'evidence_required' || stage === 'attended')
  ) {
    exceptions.push({
      code: EXCEPTION_CODES.ATTENDED_NO_EVIDENCE,
      overdueMs: ageMs(request.attendedAt || request.attendanceConfirmedAt, now) || 0,
    })
  }

  if (
    (stage === 'evidence_required' || stage === 'attended') &&
    briefingAt &&
    briefingAt.getTime() < now.getTime() &&
    evidenceN <= 0 &&
    request.evidenceOverride !== true
  ) {
    // Prefer ATTENDED_NO_EVIDENCE when already confirmed; else keep legacy code
    if (!attendanceConfirmed) {
      exceptions.push({
        code: EXCEPTION_CODES.BRIEFING_PASSED_NO_EVIDENCE,
        overdueMs: now.getTime() - briefingAt.getTime(),
      })
    }
  }

  if (stage === 'evidence_received' || stage === 'report_in_progress') {
    const since =
      ageMs(request.reportInProgressAt || request.opsUpdatedAt || request.updatedAt, now) || 0
    const briefingPassed = briefingAt && briefingAt.getTime() < now.getTime()
    if (briefingPassed || since >= thresholds.REPORT_PENDING_MS) {
      exceptions.push({
        code: EXCEPTION_CODES.EVIDENCE_RECEIVED_REPORT_PENDING,
        overdueMs: briefingPassed
          ? Math.max(since, now.getTime() - briefingAt.getTime())
          : since - thresholds.REPORT_PENDING_MS,
      })
    }
  }

  if (stage === 'report_ready') {
    const since = ageMs(request.reportReadyAt || request.updatedAt, now) || 0
    exceptions.push({
      code: EXCEPTION_CODES.REPORT_READY_NOT_SENT,
      overdueMs: Math.max(0, since - thresholds.REPORT_READY_OVERDUE_MS),
      dueSoon: since < thresholds.REPORT_READY_OVERDUE_MS,
    })
  }

  // Stuck: delivery_review abandoned
  if (
    deliveryStatus === 'delivery_review' &&
    (ageMs(request.clientDeliveryOpenedAt || request.updatedAt, now) || 0) >=
      thresholds.DELIVERY_REVIEW_ABANDONED_MS
  ) {
    exceptions.push({
      code: EXCEPTION_CODES.STUCK_LIFECYCLE,
      overdueMs: ageMs(request.clientDeliveryOpenedAt || request.updatedAt, now),
      detail: 'delivery_review_abandoned',
    })
  }

  // Stuck: reopened without progression
  if (
    request.reopenedAt &&
    !request.completedAt &&
    stage !== 'report_ready' &&
    deliveryStatus !== 'sent' &&
    deliveryStatus !== 'delivered' &&
    (ageMs(request.reopenedAt, now) || 0) >= thresholds.REOPEN_STUCK_MS
  ) {
    exceptions.push({
      code: EXCEPTION_CODES.STUCK_LIFECYCLE,
      overdueMs: ageMs(request.reopenedAt, now),
      detail: 'reopened_no_correction_progress',
    })
  }

  // Stuck: sent but lifecycle not delivered/completed (shouldn't happen often)
  if (
    (deliveryStatus === 'sent' || deliveryStatus === 'delivered') &&
    stage === 'report_ready'
  ) {
    exceptions.push({
      code: EXCEPTION_CODES.STUCK_LIFECYCLE,
      overdueMs: ageMs(request.deliveredAt || request.updatedAt, now) || 0,
      detail: 'sent_lifecycle_not_completed',
    })
  }

  // Priority order — stuck/blocked outranks generic report-ready lag
  const priority = [
    EXCEPTION_CODES.DELIVERY_BOUNCED,
    EXCEPTION_CODES.DELIVERY_FAILED,
    EXCEPTION_CODES.STUCK_LIFECYCLE,
    EXCEPTION_CODES.BRIEFING_STARTED_NO_CHECKIN,
    EXCEPTION_CODES.BRIEFING_PASSED_NO_ATTENDANCE_CONFIRMATION,
    EXCEPTION_CODES.ATTENDED_NO_EVIDENCE,
    EXCEPTION_CODES.EVIDENCE_INCOMPLETE,
    EXCEPTION_CODES.BRIEFING_PASSED_NO_EVIDENCE,
    EXCEPTION_CODES.REPRESENTATIVE_NOT_CHECKED_IN,
    EXCEPTION_CODES.REPRESENTATIVE_RESPONSE_OVERDUE,
    EXCEPTION_CODES.REPRESENTATIVE_DECLINED,
    EXCEPTION_CODES.UNASSIGNED_APPROACHING_BRIEFING,
    EXCEPTION_CODES.REPRESENTATIVE_RESPONSE_PENDING,
    EXCEPTION_CODES.REPORT_READY_NOT_SENT,
    EXCEPTION_CODES.EVIDENCE_RECEIVED_REPORT_PENDING,
  ]
  exceptions.sort(
    (a, b) => priority.indexOf(a.code) - priority.indexOf(b.code) || (b.overdueMs || 0) - (a.overdueMs || 0)
  )
  const primary = exceptions[0] || null

  let track = SLA_TRACK.ON_TRACK
  if (primary) {
    if (
      primary.code === EXCEPTION_CODES.DELIVERY_FAILED ||
      primary.code === EXCEPTION_CODES.DELIVERY_BOUNCED ||
      primary.code === EXCEPTION_CODES.STUCK_LIFECYCLE
    ) {
      track = SLA_TRACK.BLOCKED
    } else if (primary.dueSoon && (primary.overdueMs || 0) <= 0) {
      track = SLA_TRACK.DUE_SOON
    } else {
      track = SLA_TRACK.OVERDUE
    }
  } else if (stage === 'briefing_due' && briefingAt) {
    const until = briefingAt.getTime() - now.getTime()
    if (until <= thresholds.DUE_SOON_MS) track = SLA_TRACK.DUE_SOON
  }

  let boardFilter = 'in_progress'
  if (track === SLA_TRACK.BLOCKED || track === SLA_TRACK.OVERDUE) boardFilter = 'needs_attention'
  else if (track === SLA_TRACK.DUE_SOON) boardFilter = 'due_soon'
  else if (stage === 'report_ready') boardFilter = 'ready_to_send'
  else if (
    deliveryStatus === 'failed' ||
    deliveryStatus === 'bounced'
  ) {
    boardFilter = 'delivery_issue'
  }

  if (
    primary &&
    (primary.code === EXCEPTION_CODES.DELIVERY_FAILED ||
      primary.code === EXCEPTION_CODES.DELIVERY_BOUNCED)
  ) {
    boardFilter = 'delivery_issue'
  }

  return {
    stage,
    track,
    exceptionCode: primary?.code || null,
    exceptionLabel: primary ? EXCEPTION_LABELS[primary.code] : null,
    exceptionDetail: primary?.detail || null,
    overdueMs: primary?.overdueMs ?? null,
    overdueLabel: formatDuration(primary?.overdueMs),
    briefingAt: briefingAt ? briefingAt.toISOString() : null,
    timeZone: OPS_TZ,
    expectedAction: nextRequiredAction(stage),
    recommendedAction: primary
      ? recommendedActionForException(primary.code, stage)
      : { label: nextRequiredAction(stage), hrefAction: 'inspect' },
    boardFilter,
    allExceptionCodes: exceptions.map((e) => e.code),
  }
}

function classifyBoardFilter(sla, request = {}) {
  if (request.completedAt || sla.stage === 'completed') return 'completed'
  if (sla.boardFilter) return sla.boardFilter
  return 'in_progress'
}

function isCompletionEligible(request = {}, opts = {}) {
  const reasons = []
  const payment = String(request.paymentStatus || '').toLowerCase()
  if (payment !== 'paid' && payment !== 'not_required') {
    reasons.push('payment_not_recognised')
  }
  const evidenceN = Array.isArray(request.evidenceItems) ? request.evidenceItems.length : 0
  if (evidenceN <= 0 && request.evidenceOverride !== true) {
    reasons.push('evidence_required')
  }
  const reportReady =
    request.reportStatus === 'ready' ||
    request.reportStage === 'ready' ||
    Boolean(request.reportReadyAt)
  if (!reportReady) reasons.push('report_not_ready')
  if (!request.opsReportId) reasons.push('approved_report_version_missing')

  const deliveryOk = ['sent', 'delivered'].includes(
    String(request.clientDeliveryStatus || '').toLowerCase()
  )
  if (!deliveryOk && !opts.allowManualDelivered) {
    // Manual mark_delivered without Phase 12 still allowed if deliveredAt + report ready
    if (!(request.deliveredAt && reportReady)) {
      reasons.push('customer_delivery_not_accepted')
    }
  }

  if (request.completedAt) reasons.push('already_completed')

  return { eligible: reasons.length === 0, reasons }
}

module.exports = {
  OPS_TZ,
  SLA_TRACK,
  EXCEPTION_CODES,
  EXCEPTION_LABELS,
  THRESHOLDS,
  briefingMomentSa,
  evaluateOpsSla,
  classifyBoardFilter,
  isCompletionEligible,
  formatDuration,
}
