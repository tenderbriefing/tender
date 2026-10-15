import { ATTENDANCE_FEE_LABEL } from '@/lib/payments/attendanceFee'
import { isAttendanceFree } from '@/lib/domain/briefingPricing'

const free = isAttendanceFree()

/** Primary SME CTA — keep vocabulary consistent across list, detail, and checkout. */
export const BOOK_AGENT_CTA = 'Book an agent'
export const BOOK_AGENT_CTA_WITH_FEE = free
  ? 'Book an agent — Free'
  : `Book an agent — ${ATTENDANCE_FEE_LABEL}`
/** Phase 3A — physical private tender briefing CTA (UI flag gated). */
export const APPOINT_YOUTH_AGENT_CTA = free
  ? 'Appoint a Youth Agent — Free'
  : `Appoint a Youth Agent — ${ATTENDANCE_FEE_LABEL}`
export const BOOK_AGENT_SIGN_IN_CTA = 'Sign in to book an agent'
export const BOOK_AGENT_PAY_CTA = free
  ? 'Confirm free booking'
  : `Continue to pay ${ATTENDANCE_FEE_LABEL}`
