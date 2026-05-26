/**
 * Revenue optimization — pricing, margins, dispatch profitability.
 */
const { persistInsight, nowIso, clamp } = require('./_shared')
const COLLECTIONS = require('./autonomousCollections')

const BASE_BRIEFING_FEE = 850
const URGENCY_PREMIUM = 200
const TRAVEL_PER_KM = 8
const HIGH_DEMAND_PREMIUM = 150

function optimizePricing(request, context = {}) {
  const distanceKm = context.distanceKm ?? request.dispatchRadiusKm ?? 30
  const urgency = request.briefingCompulsory || context.urgency === 'critical' ? 1 : 0
  const provinceFactor = context.provinceDemand === 'high' ? 1.15 : 1
  const travelSurcharge = Math.min(400, Math.round(distanceKm * TRAVEL_PER_KM))
  const urgencyPremium = urgency ? URGENCY_PREMIUM : 0
  const demandPremium = context.highDemand ? HIGH_DEMAND_PREMIUM : 0

  let recommendedPrice = Math.round(
    (BASE_BRIEFING_FEE + travelSurcharge + urgencyPremium + demandPremium) * provinceFactor
  )
  const agentPayoutEstimate = Math.round(recommendedPrice * 0.55)
  const expectedMargin = recommendedPrice - agentPayoutEstimate
  const profitabilityScore = clamp(Math.round((expectedMargin / recommendedPrice) * 100), 0, 100)
  const travelRisk = distanceKm > 60 ? 'high' : distanceKm > 30 ? 'medium' : 'low'

  let dispatchRecommendation = 'standard_dispatch'
  if (travelRisk === 'high' && urgency) dispatchRecommendation = 'premium_agent_only'
  else if (profitabilityScore < 35) dispatchRecommendation = 'review_pricing'

  const output = {
    requestId: request.id,
    recommendedPrice,
    expectedMargin,
    profitabilityScore,
    travelRisk,
    dispatchRecommendation,
    breakdown: {
      base: BASE_BRIEFING_FEE,
      travelSurcharge,
      urgencyPremium,
      demandPremium,
      provinceFactor,
    },
    calculatedAt: nowIso(),
    aiProvider: 'rule-based',
  }

  return output
}

async function logPricingOptimization(request, context = {}) {
  const output = optimizePricing(request, context)
  const docId = `${request.id}-${Date.now()}`
  await persistInsight(COLLECTIONS.PRICING_OPTIMIZATION_LOGS, docId, output)
  return output
}

module.exports = { optimizePricing, logPricingOptimization, COLLECTION: COLLECTIONS.PRICING_OPTIMIZATION_LOGS }
