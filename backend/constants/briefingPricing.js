/**
 * Canonical commercial pricing (JS mirror of lib/domain/briefingPricing.ts).
 * Backend services must import from here — never trust client amounts.
 */

const BRIEFING_PRICE_CENTS = 34900
const YOUTH_AGENT_PAYOUT_CENTS = 20000
const GROSS_CONTRIBUTION_CENTS = BRIEFING_PRICE_CENTS - YOUTH_AGENT_PAYOUT_CENTS
const LEGACY_BRIEFING_PRICE_CENTS = 24900
const BRIEFING_PRICE_CURRENCY = 'ZAR'
const PRICING_VERSION = '2026-08-v349'
const PAYOUT_VERSION = '2026-08-fixed-200'

function resolveBriefingPriceCents() {
  const server = process.env.ATTENDANCE_FEE_CENTS
  if (server != null && server !== '') {
    const n = Number(server)
    if (Number.isFinite(n) && n > 0) return Math.round(n)
  }
  return BRIEFING_PRICE_CENTS
}

function resolveYouthAgentPayoutCents() {
  const env = process.env.YOUTH_AGENT_PAYOUT_CENTS
  if (env != null && env !== '') {
    const n = Number(env)
    if (Number.isFinite(n) && n > 0) return Math.round(n)
  }
  return YOUTH_AGENT_PAYOUT_CENTS
}

function formatBriefingPriceZar(cents = BRIEFING_PRICE_CENTS) {
  return `R${(cents / 100).toFixed(2)}`
}

function grossContributionForRevenueCents(briefingRevenueCents) {
  const revenue = Math.round(Number(briefingRevenueCents) || 0)
  const payout = resolveYouthAgentPayoutCents()
  return Math.max(0, revenue - payout)
}

function briefingPriceSnapshotFields() {
  const cents = resolveBriefingPriceCents()
  return {
    briefingPriceCents: cents,
    paymentAmount: cents,
    quotedFee: cents,
    currency: BRIEFING_PRICE_CURRENCY,
    pricingVersion: PRICING_VERSION,
  }
}

/** Resolve charge amount from an attendance request — preserves historical snapshots. */
function resolveRequestChargeCents(request) {
  if (!request) return resolveBriefingPriceCents()
  const snap = Number(request.briefingPriceCents)
  if (Number.isFinite(snap) && snap > 0) return Math.round(snap)
  const quoted = Number(request.quotedFee)
  if (Number.isFinite(quoted) && quoted > 0) return Math.round(quoted)
  const amount = Number(request.paymentAmount)
  if (Number.isFinite(amount) && amount > 0) return Math.round(amount)
  return resolveBriefingPriceCents()
}

module.exports = {
  BRIEFING_PRICE_CENTS,
  YOUTH_AGENT_PAYOUT_CENTS,
  GROSS_CONTRIBUTION_CENTS,
  LEGACY_BRIEFING_PRICE_CENTS,
  BRIEFING_PRICE_CURRENCY,
  PRICING_VERSION,
  PAYOUT_VERSION,
  resolveBriefingPriceCents,
  resolveYouthAgentPayoutCents,
  formatBriefingPriceZar,
  grossContributionForRevenueCents,
  briefingPriceSnapshotFields,
  resolveRequestChargeCents,
}
