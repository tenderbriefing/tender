/** Attendance support fee — R349.00 ZAR (cents). Server charge is canonical; display label may use NEXT_PUBLIC. */

import {
  CANONICAL_ATTENDANCE_FEE_CENTS,
  resolveAttendanceFeeCents,
  isAgentDispatchablePayment,
} from '@/lib/domain/paymentLifecycle'
import { BRIEFING_PRICE_LABEL, formatBriefingPriceZar } from '@/lib/domain/briefingPricing'

export const ATTENDANCE_FEE_CENTS = resolveAttendanceFeeCents()

export const ATTENDANCE_FEE_LABEL =
  process.env.NEXT_PUBLIC_ATTENDANCE_FEE_LABEL || BRIEFING_PRICE_LABEL

export const ATTENDANCE_FEE_CURRENCY = 'ZAR'

export { CANONICAL_ATTENDANCE_FEE_CENTS }

export function formatAttendanceFeeZar(cents = ATTENDANCE_FEE_CENTS): string {
  return formatBriefingPriceZar(cents)
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
