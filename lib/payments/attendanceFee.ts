/** Attendance support fee — R249.00 ZAR (cents). Server charge is canonical; display label may use NEXT_PUBLIC. */

import {
  CANONICAL_ATTENDANCE_FEE_CENTS,
  resolveAttendanceFeeCents,
  isAgentDispatchablePayment,
} from '@/lib/domain/paymentLifecycle'

export const ATTENDANCE_FEE_CENTS = resolveAttendanceFeeCents()

export const ATTENDANCE_FEE_LABEL =
  process.env.NEXT_PUBLIC_ATTENDANCE_FEE_LABEL || 'R249.00'

export const ATTENDANCE_FEE_CURRENCY = 'ZAR'

export { CANONICAL_ATTENDANCE_FEE_CENTS }

export function formatAttendanceFeeZar(cents = ATTENDANCE_FEE_CENTS): string {
  return `R${(cents / 100).toFixed(2)}`
}

export function paymentReferenceForRequest(requestId: string): string {
  return `TB-REQ-${requestId}`
}

export type AttendancePaymentStatus =
  | 'pending'
  | 'paid'
  | 'failed'
  | 'cancelled'
  | 'refunded'
  | 'not_required'

export function isPaidForAgentVisibility(
  paymentStatus?: string | null
): boolean {
  return isAgentDispatchablePayment(paymentStatus)
}
