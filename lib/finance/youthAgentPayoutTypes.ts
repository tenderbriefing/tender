/** Youth Agent payout ledger — server-authoritative financial records. */

export const YOUTH_AGENT_PAYOUT_STATUSES = [
  'pending',
  'eligible',
  'held',
  'paid',
  'cancelled',
] as const

export type YouthAgentPayoutStatus = (typeof YOUTH_AGENT_PAYOUT_STATUSES)[number]

export const YOUTH_AGENT_PAYOUT_ELIGIBILITY = [
  'pending_evidence',
  'eligible',
  'held',
  'paid',
  'cancelled',
  'duplicate_blocked',
] as const

export type YouthAgentPayoutEligibilityStatus =
  (typeof YOUTH_AGENT_PAYOUT_ELIGIBILITY)[number]

export interface YouthAgentPayoutRecord {
  payoutId: string
  assignmentId: string
  requestId: string
  tenderId: string
  youthAgentUid: string
  currency: 'ZAR'
  briefingRevenueCents: number
  payoutAmountCents: number
  grossContributionCents: number
  status: YouthAgentPayoutStatus
  eligibilityStatus: YouthAgentPayoutEligibilityStatus
  eligibilityReason: string | null
  attendanceVerified: boolean
  evidenceSubmitted: boolean
  reportId?: string | null
  completedAt: string | null
  eligibleAt: string | null
  paidAt: string | null
  paidBy?: string | null
  paymentReference?: string | null
  paymentMethod?: string | null
  holdReason?: string | null
  heldBy?: string | null
  heldAt?: string | null
  createdAt: string
  updatedAt: string
  pricingVersion: string
  payoutVersion: string
}

export const PAYOUT_TRANSITIONS: Record<
  YouthAgentPayoutStatus,
  readonly YouthAgentPayoutStatus[]
> = {
  pending: ['eligible', 'cancelled'],
  eligible: ['held', 'paid', 'cancelled'],
  held: ['eligible', 'cancelled'],
  paid: [],
  cancelled: [],
}

export function canTransitionPayout(
  from: YouthAgentPayoutStatus,
  to: YouthAgentPayoutStatus
): boolean {
  if (from === to) return true
  return PAYOUT_TRANSITIONS[from]?.includes(to) ?? false
}
