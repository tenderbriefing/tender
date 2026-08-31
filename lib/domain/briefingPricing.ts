/**
 * Canonical commercial pricing — server-authoritative, integer cents only.
 * Do not duplicate these constants elsewhere; import from this module.
 */

/** Current SME briefing attendance price — R349.00 */
export const BRIEFING_PRICE_CENTS = 34900

/** Fixed Youth Agent payout per successfully completed briefing — R200.00 */
export const YOUTH_AGENT_PAYOUT_CENTS = 20000

/** Platform gross contribution before other costs — R149.00 */
export const GROSS_CONTRIBUTION_CENTS = BRIEFING_PRICE_CENTS - YOUTH_AGENT_PAYOUT_CENTS

export const BRIEFING_PRICE_CURRENCY = 'ZAR'

/** Bump when commercial pricing changes; stored on new bookings/payouts. */
export const PRICING_VERSION = '2026-08-v349'

export const PAYOUT_VERSION = '2026-08-fixed-200'

/** @deprecated Use BRIEFING_PRICE_CENTS */
export const CANONICAL_ATTENDANCE_FEE_CENTS = BRIEFING_PRICE_CENTS

export function formatBriefingPriceZar(cents = BRIEFING_PRICE_CENTS): string {
  return `R${(cents / 100).toFixed(2)}`
}

export function formatYouthAgentPayoutZar(cents = YOUTH_AGENT_PAYOUT_CENTS): string {
  return `R${(cents / 100).toFixed(2)}`
}

export const BRIEFING_PRICE_LABEL = formatBriefingPriceZar()

/** Whole-rand label for SEO/marketing copy — derived from canonical cents. */
export const BRIEFING_PRICE_SHORT_LABEL = `R${Math.round(BRIEFING_PRICE_CENTS / 100)}`

export function resolveBriefingPriceCents(): number {
  const server = process.env.ATTENDANCE_FEE_CENTS
  if (server != null && server !== '') {
    const n = Number(server)
    if (Number.isFinite(n) && n > 0) return Math.round(n)
  }
  return BRIEFING_PRICE_CENTS
}

export function resolveYouthAgentPayoutCents(): number {
  const env = process.env.YOUTH_AGENT_PAYOUT_CENTS
  if (env != null && env !== '') {
    const n = Number(env)
    if (Number.isFinite(n) && n > 0) return Math.round(n)
  }
  return YOUTH_AGENT_PAYOUT_CENTS
}

export function grossContributionForRevenueCents(briefingRevenueCents: number): number {
  const revenue = Math.round(Number(briefingRevenueCents) || 0)
  const payout = resolveYouthAgentPayoutCents()
  return Math.max(0, revenue - payout)
}

export function briefingPriceSnapshotFields() {
  const cents = resolveBriefingPriceCents()
  return {
    briefingPriceCents: cents,
    paymentAmount: cents,
    quotedFee: cents,
    currency: BRIEFING_PRICE_CURRENCY,
    pricingVersion: PRICING_VERSION,
  }
}
