/** Youth Agent payout ledger — server-authoritative financial records. */

export const YOUTH_AGENT_PAYOUT_STATUSES = [
  'pending',
  'eligible',
  'held',
  'batched',
  'settled',
  /** @deprecated Legacy per-job settlement — treat as settled in summaries */
  'paid',
  'cancelled',
] as const

export type YouthAgentPayoutStatus = (typeof YOUTH_AGENT_PAYOUT_STATUSES)[number]

export const YOUTH_AGENT_PAYOUT_ELIGIBILITY = [
  'pending_evidence',
  'eligible',
  'held',
  'batched',
  'settled',
  /** @deprecated Legacy */
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
  /** Set when included in a monthly batch (awaiting EFT) */
  settlementBatchId?: string | null
  batchedAt?: string | null
  settledAt?: string | null
  settledBy?: string | null
  /** Legacy per-job settlement fields */
  paidAt?: string | null
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
  eligible: ['held', 'batched', 'paid', 'cancelled'],
  held: ['eligible', 'cancelled'],
  batched: ['settled'],
  settled: [],
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

/** Job-level payout is fully settled (monthly EFT or legacy per-job paid). */
export function isPayoutSettled(status: YouthAgentPayoutStatus): boolean {
  return status === 'settled' || status === 'paid'
}

/** Job-level payout counts toward outstanding YA liability (not yet settled). */
export function isPayoutOutstanding(status: YouthAgentPayoutStatus): boolean {
  return status === 'eligible' || status === 'held' || status === 'batched'
}
