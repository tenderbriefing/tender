/**
 * Procurement forecasting — province spikes, sector growth, briefing density.
 */
const { getStorage } = require('../storageAdapter')
const { persistInsight, nowIso } = require('./_shared')
const COLLECTIONS = require('./autonomousCollections')

function buildForecasts(tenders = []) {
  const byProvince = {}
  const bySector = {}
  const byMonth = {}
  let briefingCount = 0

  for (const t of tenders) {
    if (t.province) byProvince[t.province] = (byProvince[t.province] || 0) + 1
    const sector = t.industrySector || t.category || 'general'
    bySector[sector] = (bySector[sector] || 0) + 1
    const m = (t.publishedDate || t.scrapedAt || '').slice(0, 7)
    if (m) byMonth[m] = (byMonth[m] || 0) + 1
    if (t.briefingDate || t.briefingCompulsory) briefingCount += 1
  }

  const provinceSpikes = Object.entries(byProvince)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([province, count]) => ({ province, volume: count, trend: 'stable' }))

  const sectorGrowth = Object.entries(bySector)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([sector, volume]) => ({ sector, volume, growth: volume > 10 ? 'rising' : 'steady' }))

  const months = Object.keys(byMonth).sort()
  const avgMonthly =
    months.length > 0
      ? months.reduce((s, m) => s + byMonth[m], 0) / months.length
      : tenders.length

  return {
    provinceProcurementSpikes: provinceSpikes,
    sectorGrowth,
    expectedBriefingDensity: Math.round((briefingCount / Math.max(tenders.length, 1)) * 100),
    monthlyOpportunityTrends: byMonth,
    seasonalProcurement: months.slice(-3).map((m) => ({ month: m, volume: byMonth[m] })),
    expectedSmeDemand: Math.round(avgMonthly * 0.15),
    forecastedAt: nowIso(),
    aiProvider: 'rule-based',
  }
}

async function runProcurementForecasting() {
  const storage = getStorage()
  const tenders = await storage.getAllTenders()
  const forecast = buildForecasts(tenders)
  const docId = `forecast-${new Date().toISOString().slice(0, 7)}`
  await persistInsight(COLLECTIONS.PROCUREMENT_FORECASTS, docId, forecast)
  return { job: 'procurement_forecasting', id: docId, ...forecast }
}

module.exports = { runProcurementForecasting, buildForecasts, COLLECTION: COLLECTIONS.PROCUREMENT_FORECASTS }
