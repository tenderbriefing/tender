/**
 * Pricing intelligence — briefing fees, travel, urgency premium.
 */
const ATTENDANCE_FEE_CENTS = Number(process.env.NEXT_PUBLIC_ATTENDANCE_FEE_CENTS || 24900)
const { clamp, haversineKm, daysUntil } = require('./_shared')

function estimateBriefingPricing(context = {}) {
  const baseCents = ATTENDANCE_FEE_CENTS
  let travelImpactCents = 0
  let urgencyPremiumCents = 0

  const distanceKm = context.distanceKm ?? null
  if (distanceKm != null && distanceKm > 40) {
    travelImpactCents = Math.min(15000, Math.round((distanceKm - 40) * 200))
  }

  const days = daysUntil(context.briefingDate || context.closingDate)
  if (days != null && days <= 3) urgencyPremiumCents = 5000
  else if (days != null && days <= 7) urgencyPremiumCents = 2500

  const demandFactor = clamp(context.provinceDemand || 50, 0, 100)
  const marketDemandIndicator =
    demandFactor >= 70 ? 'high' : demandFactor >= 40 ? 'medium' : 'low'

  const recommendedCents = baseCents + travelImpactCents + urgencyPremiumCents

  return {
    baseFeeCents: baseCents,
    baseFeeZar: `R${(baseCents / 100).toFixed(2)}`,
    travelImpactCents,
    urgencyPremiumCents,
    recommendedSmeFeeCents: recommendedCents,
    recommendedSmeFeeZar: `R${(recommendedCents / 100).toFixed(2)}`,
    marketDemandIndicator,
    estimatedAgentEarningsCents: Math.round(recommendedCents * 0.65),
    capturedAt: new Date().toISOString(),
  }
}

module.exports = { estimateBriefingPricing }
