/** Monthly Youth Agent EFT settlement batches — server-authoritative. */

export const YOUTH_AGENT_PAYOUT_BATCH_STATUSES = ['ready', 'paid', 'cancelled'] as const

export type YouthAgentPayoutBatchStatus = (typeof YOUTH_AGENT_PAYOUT_BATCH_STATUSES)[number]

import type { BankingSnapshot } from './youthAgentBankingTypes'

export type YouthAgentPayoutBatchReadyReason =
  | 'ready_for_eft'
  | 'missing_bank_details'
  | 'already_paid'
  | 'cancelled'
  | 'legacy_no_snapshot'

export interface YouthAgentPayoutBatchRecord {
  batchId: string
  youthAgentUid: string
  periodYear: number
  periodMonth: number
  periodKey: string
  periodStart: string
  periodEnd: string
  currency: 'ZAR'
  eligibleJobCount: number
  grossEarningsCents: number
  payoutIds: string[]
  requestIds: string[]
  status: YouthAgentPayoutBatchStatus
  /** Immutable banking details at batch generation time. Null on legacy batches. */
  bankingSnapshot?: BankingSnapshot | null
  bankingDetailsPresent?: boolean
  createdAt: string
  createdBy: string | null
  approvedAt: string | null
  approvedBy: string | null
  paidAt: string | null
  paidBy: string | null
  paymentMethod: 'EFT' | null
  paymentReference: string | null
  paidAmountCents?: number | null
  paymentDate?: string | null
  paymentNote?: string | null
  proofOfPaymentRef?: string | null
  updatedAt: string
}

/** Calendar month inclusion is determined by eligibleAt on the job-level payout record. */
export const PAYOUT_PERIOD_INCLUSION_RULE =
  'A job-level payout belongs to the calendar month containing its eligibleAt timestamp (UTC).'

/** When a hold is released after the original period batch was already paid, eligibleAt rolls forward to release time. */
export const HOLD_RELEASE_CARRY_FORWARD_RULE =
  'If the agent’s batch for the original eligibleAt month is already paid, eligibleAt is updated to the release timestamp so the earning rolls into the next settlement period.'
