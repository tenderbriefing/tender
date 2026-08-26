/**
 * CJS fail-closed Phase 3 flags (authoritative for Node services).
 * Keep in sync with lib/privateTenders/briefingOpsFlags.ts
 */

function truthy(v) {
  if (!v) return false
  const s = String(v).trim().toLowerCase()
  return s === '1' || s === 'true' || s === 'yes' || s === 'on'
}

function isPrivateTenderBriefingBookingEnabled(env = process.env) {
  return truthy(env.PRIVATE_TENDER_BRIEFING_BOOKING_ENABLED)
}

function isBriefingIntelligenceV2Enabled(env = process.env) {
  return truthy(env.BRIEFING_INTELLIGENCE_V2_ENABLED)
}

function isBriefingFollowUpUpdatesEnabled(env = process.env) {
  return truthy(env.BRIEFING_FOLLOW_UP_UPDATES_ENABLED)
}

module.exports = {
  isPrivateTenderBriefingBookingEnabled,
  isBriefingIntelligenceV2Enabled,
  isBriefingFollowUpUpdatesEnabled,
}
