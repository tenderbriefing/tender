/**
 * Fail-closed feature flags for Private Tender Briefing Operations (Phase 3).
 * NEXT_PUBLIC_* is UI-only and must never authorize data access.
 */

function truthy(v: string | undefined | null): boolean {
  if (!v) return false
  const s = String(v).trim().toLowerCase()
  return s === '1' || s === 'true' || s === 'yes' || s === 'on'
}

/** Private tender → R349 physical briefing booking enrichment / CTA gating. */
export function isPrivateTenderBriefingBookingEnabled(): boolean {
  return truthy(process.env.PRIVATE_TENDER_BRIEFING_BOOKING_ENABLED)
}

export function isPrivateTenderBriefingBookingUiEnabled(): boolean {
  return (
    truthy(process.env.NEXT_PUBLIC_PRIVATE_TENDER_BRIEFING_BOOKING_ENABLED) ||
    isPrivateTenderBriefingBookingEnabled()
  )
}

/** Structured AI briefing intelligence v2 sections / prompt. */
export function isBriefingIntelligenceV2Enabled(): boolean {
  return truthy(process.env.BRIEFING_INTELLIGENCE_V2_ENABLED)
}

/** Post-briefing clarifications / addenda. */
export function isBriefingFollowUpUpdatesEnabled(): boolean {
  return truthy(process.env.BRIEFING_FOLLOW_UP_UPDATES_ENABLED)
}

export function isBriefingFollowUpUpdatesUiEnabled(): boolean {
  return (
    truthy(process.env.NEXT_PUBLIC_BRIEFING_FOLLOW_UP_UPDATES_ENABLED) ||
    isBriefingFollowUpUpdatesEnabled()
  )
}

export const PRIVATE_TENDER_BRIEFING_BOOKING_FLAG_KEY =
  'private_tender_briefing_booking_v1' as const
export const BRIEFING_INTELLIGENCE_V2_FLAG_KEY = 'briefing_intelligence_v2' as const
export const BRIEFING_FOLLOW_UP_UPDATES_FLAG_KEY = 'briefing_follow_up_updates_v1' as const
