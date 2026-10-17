import {
  OUTREACH_MAX_RECIPIENTS,
  OUTREACH_MAX_UPLOAD_BYTES,
  OUTREACH_MAX_WORKBOOK_ROWS,
} from './featureFlag'
import type { OutreachCampaignType, OutreachTemplateVersion } from './campaignTypes'

export type OutreachRowStatus = 'ready' | 'invalid' | 'duplicate' | 'suppressed'

export type ParsedOutreachRow = {
  name: string
  companyName: string
  email: string
  normalisedEmail: string
  status: OutreachRowStatus
  reason?: string
  rowNumber: number
}

export type OutreachCampaignStatus =
  | 'draft'
  | 'validated'
  | 'sending'
  | 'completed'
  | 'completed_with_failures'
  | 'failed'

export type OutreachDeliveryStatus =
  | 'queued'
  | 'sending'
  | 'sent'
  | 'failed'
  | 'suppressed'
  | 'skipped'
  | 'invalid'
  | 'duplicate'

export type OutreachCampaignSource = 'xlsx' | 'composer'

export type OutreachCampaign = {
  id: string
  type: OutreachCampaignType
  templateVersion: OutreachTemplateVersion
  originalFileName: string
  /** Ingress source — composer replaces Excel for new campaigns */
  source?: OutreachCampaignSource
  subject?: string | null
  /** Sanitized inner HTML body (composer campaigns) */
  composerHtml?: string | null
  fromAddress?: string | null
  toCount?: number
  ccCount?: number
  bccCount?: number
  templateKey?: string | null
  totalRows: number
  validRows: number
  invalidRows: number
  duplicateRows: number
  suppressedRows: number
  sendableRows: number
  queuedCount: number
  sentCount: number
  failedCount: number
  skippedCount: number
  status: OutreachCampaignStatus
  createdByUid: string
  createdByEmail: string
  createdAt: string
  confirmedAt: string | null
  startedAt: string | null
  completedAt: string | null
  lastErrorCode: string | null
  idempotencyKey: string
}

/** Resend lifecycle on a delivery — never equals mailbox Primary placement. */
export type OutreachProviderLifecycle =
  | 'accepted'
  | 'sent'
  | 'delayed'
  | 'delivered'
  | 'bounced'
  | 'complained'
  | 'failed'

export type OutreachDelivery = {
  id: string
  campaignId: string
  name: string
  companyName: string
  email: string
  normalisedEmail: string
  status: OutreachDeliveryStatus
  templateVersion: OutreachTemplateVersion
  /** Composer field role — each recipient is sent individually (privacy) */
  recipientField?: 'to' | 'cc' | 'bcc' | null
  resendMessageId: string | null
  /** Resend API acceptance on send — UI SUBMITTED */
  providerAcceptance?: 'accepted' | null
  /** Latest Resend webhook lifecycle (provider infrastructure) */
  providerLifecycle?: OutreachProviderLifecycle | null
  lastProviderEventId?: string | null
  lastProviderEventType?: string | null
  lastProviderEventAt?: string | null
  providerDeliveredAt?: string | null
  providerBouncedAt?: string | null
  providerComplainedAt?: string | null
  /** Founder-verified mailbox placement only */
  inboxPlacement?: string | null
  inboxPlacementProvider?: string | null
  inboxPlacementNotedAt?: string | null
  attemptCount: number
  errorCode: string | null
  errorMessageSafe: string | null
  createdAt: string
  updatedAt: string
  sentAt: string | null
}

export const OUTREACH_CAMPAIGNS = 'founderOutreachCampaigns'
export const OUTREACH_SUPPRESSIONS = 'emailSuppressions'
export const OUTREACH_PROVIDER_INDEX = 'founderOutreachByProviderId'
export const OUTREACH_RUNTIME = 'founderOutreachRuntime'
export const OUTREACH_INBOX_PLACEMENTS = 'founderOutreachInboxPlacements'

export { OUTREACH_MAX_RECIPIENTS, OUTREACH_MAX_UPLOAD_BYTES, OUTREACH_MAX_WORKBOOK_ROWS }
