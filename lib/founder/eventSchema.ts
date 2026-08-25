/**
 * First-party product event schema — allow-listed metadata only.
 * Sensitive fields (passwords, tokens, bank data, ID numbers, raw form text) are rejected.
 */

export const PRODUCT_EVENT_NAMES = [
  // Shared
  'user_logged_in',
  'google_sign_in_started',
  'google_sign_in_succeeded',
  'google_sign_in_failed',
  'first_google_registration',
  'profile_setup_failed',
  'onboarding_started',
  'onboarding_completed',
  'dashboard_viewed',
  'navigation_selected',
  'search_initiated',
  'filter_applied',
  'notification_opened',
  'help_opened',
  'feedback_submitted',
  'session_started',
  'session_ended',
  'page_viewed',
  // SME
  'tender_listing_viewed',
  'tender_opened',
  'tender_brief_opened',
  'tender_saved',
  'tender_unsaved',
  'tender_document_downloaded',
  'search_performed',
  'search_no_results',
  'profile_updated',
  'assistance_requested',
  'youth_agent_contacted',
  // Youth Agent
  'assigned_sme_opened',
  'sme_contacted',
  'contact_attempt_recorded',
  'follow_up_scheduled',
  'follow_up_completed',
  'assistance_activity_recorded',
  'tender_shared_with_sme',
  'sme_onboarding_supported',
  'issue_escalated',
  'portfolio_filtered',
  'training_resource_opened',
  'training_completed',
  'briefing_accepted',
  'briefing_declined',
  'briefing_report_submitted',
  'private_tender_submitted',
  'private_tender_approved',
  'private_tender_published',
  'private_tender_viewed',
  'private_tender_briefing_booked',
] as const

export type ProductEventName = (typeof PRODUCT_EVENT_NAMES)[number]

export const MEANINGFUL_EVENTS = new Set<ProductEventName>([
  'user_logged_in',
  'google_sign_in_succeeded',
  'first_google_registration',
  'profile_setup_failed',
  'onboarding_completed',
  'search_initiated',
  'search_performed',
  'tender_opened',
  'tender_brief_opened',
  'tender_saved',
  'tender_document_downloaded',
  'assistance_requested',
  'youth_agent_contacted',
  'assigned_sme_opened',
  'sme_contacted',
  'follow_up_completed',
  'tender_shared_with_sme',
  'briefing_accepted',
  'briefing_report_submitted',
  'profile_updated',
  'training_completed',
])

/** Background / non-meaningful (excluded from engagement). */
export const NON_MEANINGFUL_EVENTS = new Set<ProductEventName>([
  'page_viewed',
  'dashboard_viewed',
  'session_started',
  'session_ended',
  'navigation_selected',
])

export const METADATA_ALLOWLIST = new Set([
  'tenderId',
  'tenderNumber',
  'requestId',
  'queryLength',
  'resultCount',
  'province',
  'sector',
  'filterKey',
  'filterValue',
  'path',
  'feature',
  'navItem',
  'deviceCategory',
  'referralSource',
  'durationMs',
  'hasResults',
  'authenticationProvider',
  'registrationJourney',
  'errorCode',
  'pagePath',
])

export const FORBIDDEN_METADATA_KEYS = [
  'password',
  'token',
  'idToken',
  'authorization',
  'secret',
  'bank',
  'card',
  'cvv',
  'idNumber',
  'saId',
  'rawText',
  'formValue',
  'keystroke',
]

export type ActorRole = 'sme' | 'youth-agent' | 'admin' | 'founder'

export interface ProductEventInput {
  eventName: string
  sessionId?: string
  pagePath?: string
  feature?: string
  targetUserId?: string
  targetEntityType?: string
  targetEntityId?: string
  province?: string
  municipality?: string
  deviceCategory?: string
  referralSource?: string
  metadata?: Record<string, unknown>
}

export function sanitizeMetadata(
  metadata?: Record<string, unknown>
): { ok: true; metadata: Record<string, unknown> } | { ok: false; error: string } {
  if (!metadata || typeof metadata !== 'object') return { ok: true, metadata: {} }
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(metadata)) {
    const lower = key.toLowerCase()
    if (FORBIDDEN_METADATA_KEYS.some((f) => lower.includes(f.toLowerCase()))) {
      return { ok: false, error: `Forbidden metadata field: ${key}` }
    }
    if (!METADATA_ALLOWLIST.has(key)) {
      return { ok: false, error: `Unapproved metadata field: ${key}` }
    }
    if (typeof value === 'string' && value.length > 200) {
      return { ok: false, error: `Metadata value too long: ${key}` }
    }
    out[key] = value
  }
  return { ok: true, metadata: out }
}

export function isApprovedEventName(name: string): name is ProductEventName {
  return (PRODUCT_EVENT_NAMES as readonly string[]).includes(name)
}

export function isMeaningfulEvent(name: string): boolean {
  return MEANINGFUL_EVENTS.has(name as ProductEventName)
}
