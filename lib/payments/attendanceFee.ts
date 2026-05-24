/** Attendance support fee — R249.00 ZAR (amount in cents for Yoco). */
export const ATTENDANCE_FEE_CENTS = Number(
  process.env.NEXT_PUBLIC_ATTENDANCE_FEE_CENTS || 24900
)

export const ATTENDANCE_FEE_LABEL =
  process.env.NEXT_PUBLIC_ATTENDANCE_FEE_LABEL || 'R249.00'

export const ATTENDANCE_FEE_CURRENCY = 'ZAR'

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
  return paymentStatus === 'paid' || paymentStatus === 'not_required'
}
