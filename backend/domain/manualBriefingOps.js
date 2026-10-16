/**
 * JS mirror of lib/domain/manualBriefingOps.ts — keep in sync.
 */

const MANUAL_OPS_STAGES = [
  'awaiting_payment',
  'paid_agent_required',
  'agent_sourcing',
  'agent_assigned',
  'attendance_confirmed',
  'briefing_completed',
  'report_pending',
  'report_ready',
  'delivered',
]

const MANUAL_OPS_LABELS = {
  awaiting_payment: 'Awaiting Payment',
  paid_agent_required: 'Paid — Agent Required',
  agent_sourcing: 'Agent Sourcing',
  agent_assigned: 'Agent Assigned',
  attendance_confirmed: 'Attendance Confirmed',
  briefing_completed: 'Briefing Completed',
  report_pending: 'Report Pending',
  report_ready: 'Report Ready',
  delivered: 'Delivered',
}

const MANUAL_DOCUMENT_KINDS = ['rfq', 'loa', 'boq', 'other']
const SUGGESTED_AGENT_PAYOUT_CENTS = 40000
const MAX_AGENT_PAYOUT_CENTS = 60000
const MIN_AGENT_PAYOUT_CENTS = 10000

function deriveManualOpsStage(request = {}) {
  const payment = String(request.paymentStatus || '').toLowerCase()
  const workflow = String(request.status || '').toLowerCase()
  const fulfilment = String(request.fulfilmentStatus || '').toLowerCase()
  const report = String(request.reportStatus || '').toLowerCase()
  const hasAgent = Boolean(request.assignedAgentId || request.agentId)

  if (
    request.clientReportDeliveredAt ||
    request.reportDeliveredAt ||
    report === 'delivered'
  ) {
    return 'delivered'
  }
  if (request.reportApprovedAt || report === 'approved' || report === 'ready') {
    return 'report_ready'
  }
  if (
    report === 'pending' ||
    report === 'draft' ||
    report === 'submitted' ||
    fulfilment === 'report_pending'
  ) {
    return 'report_pending'
  }
  if (
    request.completed === true ||
    workflow === 'completed' ||
    fulfilment === 'completed'
  ) {
    return 'briefing_completed'
  }
  if (
    request.attended === true ||
    workflow === 'attended' ||
    fulfilment === 'confirmed' ||
    fulfilment === 'attendance_confirmed'
  ) {
    return 'attendance_confirmed'
  }
  if (hasAgent || workflow === 'assigned' || fulfilment === 'assigned') {
    return 'agent_assigned'
  }
  if (payment === 'paid' || payment === 'not_required') {
    if (request.sourcing === true || fulfilment === 'sourcing') {
      return 'agent_sourcing'
    }
    return 'paid_agent_required'
  }
  return 'awaiting_payment'
}

function manualOpsLabel(stage) {
  return MANUAL_OPS_LABELS[stage] || stage
}

function deriveUrgencyFlags(request = {}) {
  const flags = []
  const now = request.now instanceof Date ? request.now : new Date()
  const payment = String(request.paymentStatus || '').toLowerCase()
  const hasAgent = Boolean(request.assignedAgentId || request.agentId)

  if ((payment === 'paid' || payment === 'not_required') && !hasAgent) {
    flags.push('paid_no_agent')
  }

  const docs = Array.isArray(request.documents) ? request.documents : []
  const hasLoa =
    String(request.loaStatus || '').toLowerCase() === 'received' ||
    docs.some((d) => String(d.kind || '').toLowerCase() === 'loa')
  if (!hasLoa) flags.push('missing_loa')

  const venue = String(request.briefingVenue || '').trim()
  if (!venue) flags.push('venue_unconfirmed')

  const dateRaw = String(request.briefingDate || '').trim()
  if (dateRaw) {
    const briefAt = new Date(dateRaw.includes('T') ? dateRaw : `${dateRaw}T12:00:00`)
    if (!Number.isNaN(briefAt.getTime())) {
      const hours = (briefAt.getTime() - now.getTime()) / (1000 * 60 * 60)
      if (hours >= 0 && hours <= 24) flags.push('briefing_within_24h')
      else if (hours > 24 && hours <= 48) flags.push('briefing_within_48h')
    }
  }

  return flags
}

function clampAgentPayoutCents(value) {
  const n = Math.round(Number(value))
  if (!Number.isFinite(n)) return null
  if (n < MIN_AGENT_PAYOUT_CENTS || n > MAX_AGENT_PAYOUT_CENTS) return null
  return n
}

module.exports = {
  MANUAL_OPS_STAGES,
  MANUAL_OPS_LABELS,
  MANUAL_DOCUMENT_KINDS,
  SUGGESTED_AGENT_PAYOUT_CENTS,
  MAX_AGENT_PAYOUT_CENTS,
  MIN_AGENT_PAYOUT_CENTS,
  deriveManualOpsStage,
  manualOpsLabel,
  deriveUrgencyFlags,
  clampAgentPayoutCents,
}
