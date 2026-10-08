/**
 * Founder SME Outreach — fail-closed feature flag.
 * Absent / false = disabled. Only explicit true/1/yes/on enables.
 */
export function isFounderSmeOutreachEnabled(
  raw: string | undefined | null = process.env.FOUNDER_SME_OUTREACH_ENABLED
): boolean {
  if (raw == null) return false
  const v = String(raw).trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes' || v === 'on'
}

export const FOUNDER_SME_OUTREACH_FLAG_KEY = 'founder_sme_outreach' as const

/**
 * Absolute ceiling of sendable recipients per campaign.
 * This is a hard reject threshold — NOT permission to blast 2000 messages at once.
 * Actual throughput is gated by OUTREACH_SEND_CONCURRENCY + tick size + worker continuation.
 */
export const OUTREACH_MAX_RECIPIENTS = 2000

/** Max raw workbook rows (including header) accepted during parse. */
export const OUTREACH_MAX_WORKBOOK_ROWS = 2500

/** Max upload size bytes (5 MiB). */
export const OUTREACH_MAX_UPLOAD_BYTES = 5 * 1024 * 1024

/**
 * Concurrent Resend API calls within a single processCampaignSends tick.
 * Keep small to protect provider rate limits and Cloud Run CPU.
 */
export const OUTREACH_SEND_CONCURRENCY = 3

/** Max queued deliveries claimed per send tick (compose request or worker loop). */
export const OUTREACH_SEND_TICK_SIZE = 300

/** Max worker ticks per automation invocation before yielding. */
export const OUTREACH_WORKER_MAX_TICKS = 8

export const OUTREACH_TEMPLATE_VERSION = 'sme-invitation-v1' as const

export const OUTREACH_SUBJECT = 'Compulsory briefings, without the travel' as const

export const OUTREACH_CTA_LABEL = 'VIEW TENDER BRIEFINGS' as const

export const OUTREACH_CTA_PATH = '/tenders' as const

/** Youth Agent invitation — youth-agent-invitation-v1 */
export const YOUTH_AGENT_OUTREACH_TEMPLATE_VERSION = 'youth-agent-invitation-v1' as const

export const YOUTH_AGENT_OUTREACH_SUBJECT =
  'Invitation to become Youth Agents' as const

export const YOUTH_AGENT_OUTREACH_CTA_LABEL = 'JOIN AS A YOUTH AGENT' as const

/** Canonical Youth Agent registration route (see docs/GOOGLE_SIGNIN.md). */
export const YOUTH_AGENT_OUTREACH_CTA_PATH = '/auth/signup?type=youth-agent' as const
