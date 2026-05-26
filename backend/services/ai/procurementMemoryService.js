/**
 * Procurement memory — buyers, sectors, seasonal patterns, forecasts.
 */
const { getStorage } = require('../storageAdapter')
const { persistInsight, nowIso } = require('./_shared')
const COLLECTIONS = require('./autonomousCollections')

function aggregateMemory(tenders = []) {
  const buyers = {}
  const sectors = {}
  const provinces = {}
  const monthly = {}

  for (const t of tenders) {
    const buyer = t.buyer || t.department || 'Unknown'
    buyers[buyer] = (buyers[buyer] || 0) + 1
    const sector = t.industrySector || t.category || 'general'
    sectors[sector] = (sectors[sector] || 0) + 1
    if (t.province) provinces[t.province] = (provinces[t.province] || 0) + 1
    const month = (t.publishedDate || t.scrapedAt || '').slice(0, 7)
    if (month) monthly[month] = (monthly[month] || 0) + 1
  }

  const topBuyers = Object.entries(buyers)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([name, count]) => ({ name, count, repeatProcurement: count >= 3 }))

  const sectorHeatmap = Object.entries(sectors)
    .sort((a, b) => b[1] - a[1])
    .map(([sector, volume]) => ({ sector, volume }))

  const repeatAlerts = topBuyers.filter((b) => b.repeatProcurement).map((b) => ({
    buyer: b.name,
    alert: 'Recurring procurement buyer detected',
  }))

  return {
    buyerIntelligence: topBuyers,
    sectorHeatmap,
    provinceDistribution: provinces,
    monthlyTrends: monthly,
    repeatProcurementAlerts: repeatAlerts,
    procurementForecasts: Object.entries(monthly)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6)
      .map(([month, count]) => ({ month, expectedVolume: count })),
    updatedAt: nowIso(),
    aiProvider: 'rule-based',
  }
}

async function refreshProcurementMemory() {
  const storage = getStorage()
  const tenders = await storage.getAllTenders()
  const memory = aggregateMemory(tenders)
  await persistInsight(COLLECTIONS.PROCUREMENT_MEMORY, 'global', memory)
  return memory
}

module.exports = { refreshProcurementMemory, aggregateMemory, COLLECTION: COLLECTIONS.PROCUREMENT_MEMORY }
