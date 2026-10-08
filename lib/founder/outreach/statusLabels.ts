/**
 * Human-facing outreach status labels.
 * Resend API acceptance must NEVER be shown as DELIVERED until webhook confirmation exists.
 */

export type OutreachUiDeliveryStatus =
  | 'QUEUED'
  | 'SENDING'
  | 'SUBMITTED'
  | 'FAILED'
  | 'SUPPRESSED'
  | 'SKIPPED'
  | 'INVALID'
  | 'DUPLICATE'

export type OutreachUiCampaignStatus =
  | 'DRAFT'
  | 'VALIDATED'
  | 'SENDING'
  | 'COMPLETED'
  | 'COMPLETED_WITH_FAILURES'
  | 'FAILED'

/** Map Firestore delivery.status → Founder UI label */
export function labelDeliveryStatus(status: string | null | undefined): OutreachUiDeliveryStatus {
  switch (String(status || '').toLowerCase()) {
    case 'queued':
      return 'QUEUED'
    case 'sending':
      return 'SENDING'
    case 'sent':
      // Provider accepted the API request — not mailbox delivery confirmation
      return 'SUBMITTED'
    case 'failed':
      return 'FAILED'
    case 'suppressed':
      return 'SUPPRESSED'
    case 'skipped':
      return 'SKIPPED'
    case 'invalid':
      return 'INVALID'
    case 'duplicate':
      return 'DUPLICATE'
    default:
      return 'QUEUED'
  }
}

export function labelCampaignStatus(status: string | null | undefined): OutreachUiCampaignStatus {
  switch (String(status || '').toLowerCase()) {
    case 'draft':
      return 'DRAFT'
    case 'validated':
      return 'VALIDATED'
    case 'sending':
      return 'SENDING'
    case 'completed':
      return 'COMPLETED'
    case 'completed_with_failures':
      return 'COMPLETED_WITH_FAILURES'
    case 'failed':
      return 'FAILED'
    default:
      return 'VALIDATED'
  }
}

/** Copy for Founder confirmation modal — always explicit individual email count. */
export function individualEmailConfirmCopy(count: number): string {
  const n = Math.max(0, Math.floor(Number(count) || 0))
  return `You are about to send ${n} individual email${n === 1 ? '' : 's'}.`
}

/** Explain suppressed exclusions — never offers override. */
export function suppressionExclusionCopy(suppressedCount: number): string | null {
  const n = Math.max(0, Math.floor(Number(suppressedCount) || 0))
  if (n <= 0) return null
  return `${n} recipient${n === 1 ? ' has' : 's have'} been excluded because of suppression/unsubscribe and will not be sent.`
}

export function providerAcceptanceDisclaimer(): string {
  return 'SUBMITTED means Resend accepted the send API call. It is not mailbox delivery confirmation (DELIVERED requires webhook confirmation, which is not yet wired for outreach).'
}
