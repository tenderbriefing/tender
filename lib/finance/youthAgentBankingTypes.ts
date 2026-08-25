/** Youth Agent banking profile — captured once, reused for monthly EFT. */

export const YA_BANK_ACCOUNT_TYPES = [
  'cheque',
  'savings',
  'transmission',
  'current',
  'other',
] as const

export type YaBankAccountType = (typeof YA_BANK_ACCOUNT_TYPES)[number]

export interface YouthAgentBankingProfile {
  youthAgentUid: string
  accountHolderName: string
  bankName: string
  /** Full account number — Founder/Admin APIs only; never log. */
  accountNumber: string
  accountType: YaBankAccountType
  branchCode: string
  bankAccountNickname?: string | null
  proofOfBankAccountRef?: string | null
  version: number
  createdAt: string
  updatedAt: string
  createdBy: string
  updatedBy: string
}

/** Public / YA-safe presentation (masked account number). */
export interface YouthAgentBankingProfilePublic {
  youthAgentUid: string
  accountHolderName: string
  bankName: string
  accountNumberMasked: string
  accountType: YaBankAccountType
  branchCode: string
  bankAccountNickname?: string | null
  hasProofOfBankAccount: boolean
  version: number
  updatedAt: string
  isComplete: boolean
}

/** Immutable snapshot stored on monthly payout batches. */
export interface BankingSnapshot {
  bankingProfileVersion: number
  accountHolderName: string
  bankName: string
  accountNumber: string
  accountType: string
  branchCode: string
  accountNumberMasked: string
  snapshottedAt: string
}

export function maskAccountNumber(accountNumber: string | null | undefined): string {
  const digits = String(accountNumber || '').replace(/\s+/g, '')
  if (!digits) return '—'
  if (digits.length <= 4) return `****${digits}`
  return `${'*'.repeat(Math.min(6, digits.length - 4))}${digits.slice(-4)}`
}

export function isBankingProfileComplete(
  profile: Partial<YouthAgentBankingProfile> | null | undefined
): boolean {
  if (!profile) return false
  return Boolean(
    String(profile.accountHolderName || '').trim() &&
      String(profile.bankName || '').trim() &&
      String(profile.accountNumber || '').replace(/\s+/g, '').length >= 5 &&
      String(profile.accountType || '').trim() &&
      String(profile.branchCode || '').replace(/\s+/g, '').length >= 4
  )
}
