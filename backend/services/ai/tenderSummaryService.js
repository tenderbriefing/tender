/**
 * AI tender summaries — compulsory briefing, dates, risks, deliverables.
 */
const aiSummaryService = require('../aiSummaryService')
const { persistInsight, nowIso } = require('./_shared')

async function generateTenderSummary(tender) {
  const enriched = await aiSummaryService.generateSummary(tender)
  const deliverables = [
    ...(enriched.requirements || []).slice(0, 8),
    enriched.briefingCompulsory ? 'Attend compulsory briefing (or arrange agent)' : null,
    enriched.closingDate ? `Submit bid before ${enriched.closingDate}` : null,
  ].filter(Boolean)

  const insight = {
    tenderId: tender.id || tender.tenderNumber,
    summary: enriched.summary,
    compulsoryBriefing: Boolean(enriched.briefingCompulsory),
    briefingDate: enriched.briefingDate || null,
    briefingVenue: enriched.briefingVenue || null,
    keyDates: enriched.keyDates || [],
    requirements: enriched.requirements || [],
    riskIndicators: enriched.risks || [],
    deliverables,
    aiProvider: enriched.aiProvider || 'rule-based',
    capturedAt: nowIso(),
  }

  if (tender.id) {
    await persistInsight('aiTenderInsights', String(tender.id), insight)
  }
  return insight
}

module.exports = { generateTenderSummary }
