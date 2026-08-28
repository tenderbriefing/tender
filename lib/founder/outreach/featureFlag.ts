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

/** Max sendable recipients per campaign (reject above; never silently truncate). */
export const OUTREACH_MAX_RECIPIENTS = 2000

/** Max raw workbook rows (including header) accepted during parse. */
export const OUTREACH_MAX_WORKBOOK_ROWS = 2500

/** Max upload size bytes (5 MiB). */
export const OUTREACH_MAX_UPLOAD_BYTES = 5 * 1024 * 1024

/** Concurrent Resend sends within a worker tick. */
export const OUTREACH_SEND_CONCURRENCY = 3

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
