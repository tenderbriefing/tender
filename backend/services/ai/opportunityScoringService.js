/**
 * Tender opportunity scoring for SMEs.
 */
const { clamp, daysUntil, persistInsight, nowIso } = require('./_shared')

function scoreTenderOpportunity(tender, smeProfile = {}) {
  let opportunity = 50
  let complexity = 40
  let competition = 50
  let urgency = 30
  let suitability = 55

  if (tender.briefingCompulsory) {
    opportunity += 12
    complexity += 15
    suitability += 5
  }
  const days = daysUntil(tender.closingDate)
  if (days != null) {
    if (days <= 7) urgency = 95
    else if (days <= 14) urgency = 75
    else if (days <= 30) urgency = 55
    if (days <= 3) complexity += 20
  }
  if (tender.estimatedValue) {
    const v = Number(String(tender.estimatedValue).replace(/[^\d.]/g, ''))
    if (v > 5000000) competition += 25
    if (v < 500000) competition -= 15
  }
  const smeProvince = smeProfile.province
  if (smeProvince && tender.province && smeProvince === tender.province) {
    suitability += 20
    opportunity += 8
  }
  const cats = smeProfile.categories || smeProfile.sectors || []
  if (tender.industrySector && cats.some((c) => String(c).includes(tender.industrySector))) {
    suitability += 15
  }

  const scores = {
    tenderId: tender.id || tender.tenderNumber,
    opportunityScore: clamp(Math.round(opportunity), 0, 100),
    complexityScore: clamp(Math.round(complexity), 0, 100),
    competitionLikelihood: clamp(Math.round(competition), 0, 100),
    urgencyScore: clamp(Math.round(urgency), 0, 100),
    smeSuitabilityScore: clamp(Math.round(suitability), 0, 100),
    capturedAt: nowIso(),
  }
  return scores
}

async function scoreAndPersist(tender, smeProfile) {
  const scores = scoreTenderOpportunity(tender, smeProfile)
  if (tender.id) {
    await persistInsight('aiTenderInsights', `${tender.id}_scores`, {
      ...scores,
      type: 'opportunity_scores',
    })
  }
  return scores
}

module.exports = { scoreTenderOpportunity, scoreAndPersist }
