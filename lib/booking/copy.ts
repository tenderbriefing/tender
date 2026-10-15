import { isAttendanceFree } from '@/lib/domain/briefingPricing'

/** Shared SME booking / attendance-request marketing copy. */

export const ATTENDANCE_PRICING_HIGHLIGHTS = [
  'Verified Youth Agent attends briefing on your behalf',
  'Structured briefing report within 24 hours',
  'WhatsApp + in-app status updates',
  'SLA-tracked dispatch with attendance proof',
] as const

export const ATTENDANCE_NEXT_STEPS = isAttendanceFree()
  ? ([
      'Confirm your free booking — no payment required',
      'We notify nearby Youth Agents automatically',
      'Track status and receive your Briefing Report',
    ] as const)
  : ([
      'Pay the fixed fee securely (PayFast)',
      'We confirm your booking server-side, then notify nearby Youth Agents',
      'Track status — report follows after attendance, not at checkout',
    ] as const)
