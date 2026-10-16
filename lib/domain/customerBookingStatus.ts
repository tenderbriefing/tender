/**
 * Customer-safe booking status labels (Phase 14).
 * Never expose raw ops enums, SLA tracks, or exception queue codes.
 */

export type CustomerBookingStatusKey =
  | 'payment_required'
  | 'payment_processing'
  | 'booking_confirmed'
  | 'representative_arranging'
  | 'representative_confirmed'
  | 'briefing_processing'
  | 'report_preparing'
  | 'report_ready'
  | 'completed'
  | 'payment_failed'
  | 'cancelled'

const LABELS: Record<CustomerBookingStatusKey, string> = {
  payment_required: 'Payment required',
  payment_processing: 'Payment processing',
  booking_confirmed: 'Payment received',
  representative_arranging: 'Representative being arranged',
  representative_confirmed: 'Representative confirmed',
  briefing_processing: 'Briefing attended / processing report',
  report_preparing: 'Report being prepared',
  report_ready: 'Report ready / delivered',
  completed: 'Completed',
  payment_failed: 'Payment failed — retry required',
  cancelled: 'Cancelled',
}

export function customerBookingStatusLabel(key: CustomerBookingStatusKey): string {
  return LABELS[key] || 'Booking update'
}

/**
 * Map authoritative payment + ops fields to a customer-facing status.
 */
export function resolveCustomerBookingStatus(request: {
  paymentStatus?: string | null
  opsStage?: string | null
  status?: string | null
  completedAt?: string | null
  deliveredAt?: string | null
  reportReadyAt?: string | null
  assignedAgentId?: string | null
  agentId?: string | null
}): CustomerBookingStatusKey {
  const payment = String(request.paymentStatus || '').toLowerCase()
  const stage = String(request.opsStage || '').toLowerCase()
  const workflow = String(request.status || '').toLowerCase()

  if (payment === 'cancelled') return 'cancelled'
  if (payment === 'failed') return 'payment_failed'
  if (payment === 'pending' || payment === '' || !payment) {
    if (stage === 'payment_required' || !stage) return 'payment_required'
    return 'payment_processing'
  }
  if (payment !== 'paid' && payment !== 'not_required') {
    return 'payment_required'
  }

  if (request.completedAt || stage === 'closed' || stage === 'completed' || workflow === 'completed') {
    return 'completed'
  }
  if (
    request.deliveredAt ||
    stage === 'delivered' ||
    stage === 'report_ready' ||
    request.reportReadyAt
  ) {
    return 'report_ready'
  }
  if (stage === 'report_in_progress' || stage === 'evidence_received' || stage === 'evidence_required') {
    return 'report_preparing'
  }
  if (stage === 'briefing_due' || stage === 'attended') {
    return 'briefing_processing'
  }
  if (
    request.assignedAgentId ||
    request.agentId ||
    stage === 'assigned' ||
    workflow === 'assigned' ||
    workflow === 'accepted'
  ) {
    return 'representative_confirmed'
  }
  if (
    stage === 'assignment_required' ||
    stage === 'assignment_pending' ||
    stage === 'paid_agent_required'
  ) {
    return 'representative_arranging'
  }
  return 'booking_confirmed'
}

export function customerBookingStatusFromRequest(request: Parameters<
  typeof resolveCustomerBookingStatus
>[0]): { key: CustomerBookingStatusKey; label: string } {
  const key = resolveCustomerBookingStatus(request)
  return { key, label: customerBookingStatusLabel(key) }
}
