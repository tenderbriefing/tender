/**
 * Procurement graph analytics — departments, provinces, trends, hotspots.
 */
const { getFirestore } = require('../../config/firebaseAdmin')
const { sanitizeFirestoreData } = require('../../utils/sanitizeFirestoreData')
const { getStorage } = require('../storageAdapter')

const METRICS_COLLECTION = 'procurementGraphMetrics'

async function computeGraphMetrics() {
  const storage = getStorage()
  const tenders = await storage.getAllTenders()

  const byDepartment = {}
  const byProvince = {}
  const bySource = {}
  const byMonth = {}
  const briefingHotspots = {}
  const buyers = {}

  for (const t of tenders) {
    const dept = t.department || t.organisation || 'Unknown'
    const prov = t.province || 'Unknown'
    const src = t.source || t.sourceLabel || 'etenders'
    const month = String(t.closingDate || t.briefingDate || t.createdAt || '').slice(0, 7) || 'unknown'

    byDepartment[dept] = (byDepartment[dept] || 0) + 1
    byProvince[prov] = (byProvince[prov] || 0) + 1
    bySource[src] = (bySource[src] || 0) + 1
    byMonth[month] = (byMonth[month] || 0) + 1

    if (t.briefingCompulsory || t.compulsoryBriefing) {
      briefingHotspots[prov] = (briefingHotspots[prov] || 0) + 1
    }

    buyers[dept] = buyers[dept] || { count: 0, compulsory: 0 }
    buyers[dept].count += 1
    if (t.briefingCompulsory || t.compulsoryBriefing) buyers[dept].compulsory += 1
  }

  const topDepartments = Object.entries(byDepartment)
    .map(([department, count]) => ({ department, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15)

  const provinceActivity = Object.entries(byProvince)
    .map(([province, tenderCount]) => ({
      province,
      tenderCount,
      briefingCount: briefingHotspots[province] || 0,
    }))
    .sort((a, b) => b.tenderCount - a.tenderCount)

  const seasonalTrends = Object.entries(byMonth)
    .map(([month, volume]) => ({ month, volume }))
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-18)

  const recurringBuyers = Object.entries(buyers)
    .filter(([, v]) => v.count >= 3)
    .map(([department, v]) => ({ department, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12)

  return {
    generatedAt: new Date().toISOString(),
    totalTenders: tenders.length,
    bySource,
    topDepartments,
    provinceActivity,
    seasonalTrends,
    briefingHotspots: Object.entries(briefingHotspots)
      .map(([province, count]) => ({ province, count }))
      .sort((a, b) => b.count - a.count),
    recurringBuyers,
    tenderFrequency: {
      avgPerMonth:
        seasonalTrends.length > 0
          ? Math.round(
              seasonalTrends.reduce((s, m) => s + m.volume, 0) / seasonalTrends.length
            )
          : 0,
    },
  }
}

async function persistGraphMetrics(metrics) {
  const db = getFirestore()
  const docId = `graph-${new Date().toISOString().slice(0, 10)}`
  const payload = sanitizeFirestoreData({ ...metrics, id: docId })
  await db.collection(METRICS_COLLECTION).doc(docId).set(payload, { merge: true })
  return payload
}

async function refreshGraphMetrics() {
  const metrics = await computeGraphMetrics()
  return persistGraphMetrics(metrics)
}

async function getLatestGraphMetrics() {
  const db = getFirestore()
  const snap = await db.collection(METRICS_COLLECTION).limit(30).get().catch(() => ({ docs: [] }))
  const items = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => new Date(b.generatedAt || 0) - new Date(a.generatedAt || 0))
  return items[0] || (await refreshGraphMetrics())
}

module.exports = {
  METRICS_COLLECTION,
  computeGraphMetrics,
  persistGraphMetrics,
  refreshGraphMetrics,
  getLatestGraphMetrics,
}
