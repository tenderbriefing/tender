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

export type OutreachCampaign = {
  id: string
  type: OutreachCampaignType
  templateVersion: OutreachTemplateVersion
  originalFileName: string
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

export type OutreachDelivery = {
  id: string
  campaignId: string
  name: string
  companyName: string
  email: string
  normalisedEmail: string
  status: OutreachDeliveryStatus
  templateVersion: OutreachTemplateVersion
  resendMessageId: string | null
  attemptCount: number
  errorCode: string | null
  errorMessageSafe: string | null
  createdAt: string
  updatedAt: string
  sentAt: string | null
}

export const OUTREACH_CAMPAIGNS = 'founderOutreachCampaigns'
export const OUTREACH_SUPPRESSIONS = 'emailSuppressions'

export { OUTREACH_MAX_RECIPIENTS, OUTREACH_MAX_UPLOAD_BYTES, OUTREACH_MAX_WORKBOOK_ROWS }
