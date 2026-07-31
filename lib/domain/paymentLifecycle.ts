/**
 * Attendance payment lifecycle — server-authoritative states.
 * Client redirects must never drive these transitions.
 */

export const PAYMENT_STATES = [
  'created',
  'pending',
  'processing',
  'paid',
  'failed',
  'cancelled',
  'expired',
  'refunded',
  'disputed',
  'not_required',
] as const

export type PaymentState = (typeof PAYMENT_STATES)[number]

/** Maps persisted attendance paymentStatus values into the enterprise model. */
export function normalizePaymentState(raw?: string | null): PaymentState {
  if (!raw) return 'pending'
  if ((PAYMENT_STATES as readonly string[]).includes(raw)) return raw as PaymentState
  return 'pending'
}

const ALLOWED: Record<PaymentState, readonly PaymentState[]> = {
  created: ['pending', 'cancelled', 'expired'],
  pending: ['processing', 'paid', 'failed', 'cancelled', 'expired'],
  processing: ['paid', 'failed', 'cancelled'],
  paid: ['refunded', 'disputed'],
  failed: ['pending', 'cancelled'],
  cancelled: [],
  expired: ['pending'],
  refunded: [],
  disputed: ['paid', 'refunded'],
  not_required: ['paid', 'cancelled'],
}

export function canTransitionPayment(from: PaymentState, to: PaymentState): boolean {
  if (from === to) return true
  return ALLOWED[from]?.includes(to) ?? false
}

export function assertPaymentTransition(fromRaw: string | null | undefined, to: PaymentState): void {
  const from = normalizePaymentState(fromRaw)
  if (!canTransitionPayment(from, to)) {
    throw new Error(`Invalid payment transition: ${from} → ${to}`)
  }
}

export function isAgentDispatchablePayment(status?: string | null): boolean {
  const s = normalizePaymentState(status)
  return s === 'paid' || s === 'not_required'
}

/** Canonical attendance fee in cents — R249.00. Not client-overridable for server charges. */
export const CANONICAL_ATTENDANCE_FEE_CENTS = 24900

export function resolveAttendanceFeeCents(): number {
  const server = process.env.ATTENDANCE_FEE_CENTS
  if (server != null && server !== '') {
    const n = Number(server)
    if (Number.isFinite(n) && n > 0) return Math.round(n)
  }
  // Display env may exist; server charge still defaults to canonical R249 unless ATTENDANCE_FEE_CENTS set.
  return CANONICAL_ATTENDANCE_FEE_CENTS
}

export function amountsMatchCents(expectedCents: number, paidZar: number, toleranceCents = 1): boolean {
  const paidCents = Math.round(Number(paidZar) * 100)
  if (!Number.isFinite(paidCents) || paidCents <= 0) return false
  return Math.abs(paidCents - expectedCents) <= toleranceCents
}
