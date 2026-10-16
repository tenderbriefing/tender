/**
 * JS mirror of lib/domain/manualBriefingOps.ts — keep in sync (Phase 10).
 */

const OPS_LIFECYCLE_STAGES = [
  'payment_required',
  'paid',
  'assignment_required',
  'assignment_pending',
  'assigned',
  'briefing_due',
  'attended',
  'evidence_required',
  'evidence_received',
  'report_in_progress',
  'report_ready',
  'delivered',
  'completed',
  'closed',
]

const MANUAL_OPS_STAGES = OPS_LIFECYCLE_STAGES

const OPS_LIFECYCLE_LABELS = {
  payment_required: 'Payment Required',
  paid: 'Paid',
  assignment_required: 'Assignment Required',
  assignment_pending: 'Awaiting Representative Acceptance',
  assigned: 'Assigned',
  briefing_due: 'Briefing Due',
  attended: 'Attended',
  evidence_required: 'Evidence Required',
  evidence_received: 'Evidence Received',
  report_in_progress: 'Report In Progress',
  report_ready: 'Report Ready',
  delivered: 'Delivered',
  completed: 'Completed',
  closed: 'Closed',
}

const MANUAL_OPS_LABELS = OPS_LIFECYCLE_LABELS

const OPS_STAGE_ALIASES = {
  awaiting_payment: 'payment_required',
  payment_required: 'payment_required',
  paid: 'paid',
  paid_agent_required: 'assignment_required',
  paid_assignment_required: 'assignment_required',
  assignment_required: 'assignment_required',
  agent_sourcing: 'assignment_required',
  assignment_pending: 'assignment_pending',
  awaiting_acceptance: 'assignment_pending',
  agent_assigned: 'assigned',
  assigned: 'assigned',
  briefing_due: 'briefing_due',
  attendance_confirmed: 'attended',
  attended: 'attended',
  evidence_required: 'evidence_required',
  evidence_received: 'evidence_received',
  briefing_completed: 'evidence_received',
  report_pending: 'report_in_progress',
  report_in_progress: 'report_in_progress',
  report_ready: 'report_ready',
  delivered: 'delivered',
  completed: 'completed',
  fulfilment_completed: 'completed',
  closed: 'closed',
}

function normalizeOpsStage(raw) {
  const key = String(raw || '').trim().toLowerCase()
  if (!key) return null
  return OPS_STAGE_ALIASES[key] || null
}

const MANUAL_DOCUMENT_KINDS = ['rfq', 'loa', 'boq', 'other']
const OPS_EVIDENCE_CATEGORIES = [
  'attendance_proof',
  'site_photos',
  'briefing_photos',
  'documents',
  'notes',
  'other',
]

const SUGGESTED_AGENT_PAYOUT_CENTS = 40000
const MAX_AGENT_PAYOUT_CENTS = 60000
const MIN_AGENT_PAYOUT_CENTS = 10000

function hasRepresentative(request) {
  // Phase 15: pending/declined/expired dispatch must not count as assigned.
  try {
    const { hasConfirmedRepresentative } = require('./assignmentDispatch')
    return hasConfirmedRepresentative(request)
  } catch {
    return Boolean(
      request.assignedAgentId ||
        request.agentId ||
        String(request.representativeName || '').trim()
    )
  }
}

function evidenceCountOf(request) {
  if (Number.isFinite(Number(request.evidenceCount))) {
    return Math.max(0, Number(request.evidenceCount))
  }
  return Array.isArray(request.evidenceItems) ? request.evidenceItems.length : 0
}

function briefingMoment(request) {
  const dateRaw = String(request.briefingDate || '').trim()
  if (!dateRaw) return null
  const timeRaw = String(request.briefingTime || '12:00').trim() || '12:00'
  const iso = dateRaw.includes('T')
    ? dateRaw
    : `${dateRaw}T${/^\d{1,2}:\d{2}/.test(timeRaw) ? timeRaw.slice(0, 5) : '12:00'}:00`
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

function deriveManualOpsStage(request = {}) {
  const explicit = normalizeOpsStage(request.opsStage)
  if (explicit === 'closed' || request.closedAt) return 'closed'
  if (
    explicit === 'completed' ||
    request.completedAt ||
    String(request.fulfilmentStatus || '').toLowerCase() === 'completed'
  ) {
    return 'completed'
  }
  if (
    explicit === 'delivered' ||
    request.deliveredAt ||
    request.clientReportDeliveredAt ||
    request.reportDeliveredAt
  ) {
    return 'delivered'
  }

  const payment = String(request.paymentStatus || '').toLowerCase()
  const workflow = String(request.status || '').toLowerCase()
  const fulfilment = String(request.fulfilmentStatus || '').toLowerCase()
  const report = String(request.reportStatus || request.reportStage || '').toLowerCase()
  const hasRep = hasRepresentative(request)
  const evidenceN = evidenceCountOf(request)
  const hasEvidence = evidenceN > 0 || request.evidenceOverride === true

  if (workflow === 'closed') return 'closed'

  if (
    report === 'ready' ||
    report === 'approved' ||
    request.reportApprovedAt ||
    request.reportReadyAt ||
    explicit === 'report_ready'
  ) {
    return 'report_ready'
  }

  if (
    report === 'in_progress' ||
    report === 'pending' ||
    report === 'draft' ||
    report === 'submitted' ||
    explicit === 'report_in_progress' ||
    fulfilment === 'report_pending'
  ) {
    return 'report_in_progress'
  }

  if (
    explicit === 'evidence_received' ||
    (hasEvidence && (request.attended === true || explicit === 'attended'))
  ) {
    if (hasEvidence) return 'evidence_received'
  }

  if (
    request.attended === true ||
    request.attendedAt ||
    workflow === 'attended' ||
    fulfilment === 'confirmed' ||
    fulfilment === 'attendance_confirmed' ||
    explicit === 'attended' ||
    explicit === 'evidence_required'
  ) {
    if (!hasEvidence && request.evidenceOverride !== true) return 'evidence_required'
    return hasEvidence ? 'evidence_received' : 'attended'
  }

  if (hasRep || workflow === 'assigned' || fulfilment === 'assigned' || explicit === 'assigned') {
    const dueAt = briefingMoment(request)
    const now = request.now || new Date()
    if (dueAt && dueAt.getTime() <= now.getTime() + 48 * 60 * 60 * 1000) {
      if (!request.attended && !request.attendedAt) return 'briefing_due'
    }
    return 'assigned'
  }

  if (payment === 'paid' || payment === 'not_required') {
    const sub = String(request.assignmentSubstate || '')
      .trim()
      .toLowerCase()
    if (
      explicit === 'assignment_pending' ||
      sub === 'dispatch_sent' ||
      sub === 'candidate_selected'
    ) {
      return 'assignment_pending'
    }
    if (explicit === 'paid') return 'paid'
    return 'assignment_required'
  }

  return 'payment_required'
}

function manualOpsLabel(stage) {
  const normalized = normalizeOpsStage(stage) || stage
  return OPS_LIFECYCLE_LABELS[normalized] || String(stage)
}

function deriveUrgencyFlags(request = {}) {
  const flags = []
  const now = request.now instanceof Date ? request.now : new Date()
  const stage = deriveManualOpsStage({ ...request, now })

  if (stage === 'payment_required') flags.push('payment_required')
  if (stage === 'assignment_required' || stage === 'assignment_pending') {
    flags.push('assignment_required')
    flags.push('paid_no_agent')
  }
  if (stage === 'assignment_pending') flags.push('assignment_pending')
  if (stage === 'briefing_due') flags.push('briefing_due')
  if (stage === 'evidence_required') flags.push('evidence_required')
  if (stage === 'report_in_progress' || stage === 'evidence_received') {
    flags.push('report_required')
  }
  if (stage === 'report_ready') flags.push('report_ready')

  const docs = Array.isArray(request.documents) ? request.documents : []
  const hasLoa =
    String(request.loaStatus || '').toLowerCase() === 'received' ||
    docs.some((d) => String(d.kind || '').toLowerCase() === 'loa')
  if (!hasLoa) flags.push('missing_loa')

  const venue = String(request.briefingVenue || '').trim()
  if (!venue) flags.push('venue_unconfirmed')

  const dueAt = briefingMoment(request)
  if (dueAt) {
    const hours = (dueAt.getTime() - now.getTime()) / (1000 * 60 * 60)
    if (hours >= 0 && hours <= 24) flags.push('briefing_within_24h')
    else if (hours > 24 && hours <= 48) flags.push('briefing_within_48h')
  }

  return [...new Set(flags)]
}

function nextRequiredAction(stage) {
  switch (stage) {
    case 'payment_required':
      return 'Collect payment / send invoice link'
    case 'paid':
    case 'assignment_required':
      return 'Select representative and dispatch'
    case 'assignment_pending':
      return 'Await representative acceptance (or reassign)'
    case 'assigned':
      return 'Monitor briefing date'
    case 'briefing_due':
      return 'Confirm attendance'
    case 'attended':
    case 'evidence_required':
      return 'Upload attendance evidence'
    case 'evidence_received':
      return 'Generate report draft'
    case 'report_in_progress':
      return 'Review, edit, and Approve Final Report'
    case 'report_ready':
      return 'Send report to client (delivery review)'
    case 'delivered':
      return 'Mark fulfilment completed'
    case 'completed':
      return 'Close when ops complete'
    case 'closed':
      return 'None'
    default:
      return 'Review request'
  }
}

function clampAgentPayoutCents(value) {
  const n = Math.round(Number(value))
  if (!Number.isFinite(n)) return null
  if (n < MIN_AGENT_PAYOUT_CENTS || n > MAX_AGENT_PAYOUT_CENTS) return null
  return n
}

const OPS_ADMIN_TRANSITIONS = {
  payment_required: [],
  paid: ['assignment_required'],
  assignment_required: ['assignment_pending', 'assigned'],
  assignment_pending: ['assigned', 'assignment_required'],
  assigned: ['briefing_due', 'attended'],
  briefing_due: ['attended'],
  attended: ['evidence_required', 'evidence_received'],
  evidence_required: ['evidence_received', 'report_in_progress'],
  evidence_received: ['report_in_progress', 'report_ready'],
  report_in_progress: ['report_ready'],
  report_ready: ['delivered'],
  delivered: ['completed', 'closed'],
  completed: ['closed'],
  closed: [],
}

module.exports = {
  OPS_LIFECYCLE_STAGES,
  MANUAL_OPS_STAGES,
  OPS_LIFECYCLE_LABELS,
  MANUAL_OPS_LABELS,
  OPS_STAGE_ALIASES,
  normalizeOpsStage,
  MANUAL_DOCUMENT_KINDS,
  OPS_EVIDENCE_CATEGORIES,
  SUGGESTED_AGENT_PAYOUT_CENTS,
  MAX_AGENT_PAYOUT_CENTS,
  MIN_AGENT_PAYOUT_CENTS,
  deriveManualOpsStage,
  manualOpsLabel,
  deriveUrgencyFlags,
  nextRequiredAction,
  clampAgentPayoutCents,
  OPS_ADMIN_TRANSITIONS,
}
