/**
 * AI procurement watchlist — SME preferences and matching opportunities.
 */
const { getFirestore } = require('../../config/firebaseAdmin')
const { persistInsight, nowIso } = require('./_shared')
const { getStorage } = require('../storageAdapter')
const COLLECTIONS = require('./autonomousCollections')

function inferPreferencesFromHistory(requests = [], tenders = []) {
  const sectors = {}
  const provinces = {}
  const buyers = {}
  for (const r of requests) {
    if (r.province) provinces[r.province] = (provinces[r.province] || 0) + 1
    if (r.department) buyers[r.department] = (buyers[r.department] || 0) + 1
  }
  for (const t of tenders) {
    if (t.category) sectors[t.category] = (sectors[t.category] || 0) + 1
    if (t.industrySector) sectors[t.industrySector] = (sectors[t.industrySector] || 0) + 1
    if (t.buyer) buyers[t.buyer] = (buyers[t.buyer] || 0) + 1
    if (t.department) buyers[t.department] = (buyers[t.department] || 0) + 1
    if (t.province) provinces[t.province] = (provinces[t.province] || 0) + 1
  }
  const top = (map) =>
    Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([k]) => k)
  return {
    preferredSectors: top(sectors),
    preferredProvinces: top(provinces),
    preferredBuyers: top(buyers),
    briefingAttendanceCount: requests.filter((r) => r.status === 'completed').length,
  }
}

function scoreTenderMatch(tender, prefs) {
  let score = 0
  if (prefs.preferredProvinces.includes(tender.province)) score += 25
  if (prefs.preferredSectors.includes(tender.category || tender.industrySector)) score += 20
  if (prefs.preferredBuyers.includes(tender.buyer || tender.department)) score += 15
  if (tender.briefingCompulsory) score += 10
  return score
}

async function buildWatchlistForSme(smeUid, datasets = {}) {
  const storage = getStorage()
  const allRequests = datasets.requests || await storage.getAttendanceRequests()
  const allTenders = datasets.tenders || await storage.getAllTenders()
  const requests = allRequests.filter((r) => r.smeId === smeUid)
  const tenders = allTenders.filter(
    (t) => t.visibility !== 'private' || t.ownerUid === smeUid
  )
  const prefs = inferPreferencesFromHistory(requests, tenders)

  const matches = tenders
    .map((t) => ({
      tenderId: t.id,
      title: t.title,
      province: t.province,
      briefingDate: t.briefingDate,
      matchScore: scoreTenderMatch(t, prefs),
      recurringBuyer: prefs.preferredBuyers.includes(t.buyer || t.department),
    }))
    .filter((m) => m.matchScore >= 15)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 25)

  const repeatDepartments = [...new Set(matches.filter((m) => m.recurringBuyer).map((m) => m.title))]

  const watchlist = {
    smeUid,
    ...prefs,
    matchingOpportunities: matches,
    repeatDepartmentAlerts: repeatDepartments.slice(0, 10),
    futureOpportunityHints: matches
      .filter((m) => m.briefingDate)
      .slice(0, 5)
      .map((m) => ({ tenderId: m.tenderId, hint: 'Upcoming briefing aligned with your history' })),
    updatedAt: nowIso(),
    aiProvider: 'rule-based',
  }

  await persistInsight(COLLECTIONS.PROCUREMENT_WATCHLISTS, smeUid, watchlist)
  return watchlist
}

async function refreshAllWatchlists(options = {}) {
  if (typeof options === 'number') options = { batchSize: options }
  const db = getFirestore()
  const storage = getStorage()
  const offset = Math.max(0, Number(options.offset) || 0)
  const batchSize = Math.max(1, Math.min(Number(options.batchSize) || 5, 20))
  const [snap, tenders, requests] = await Promise.all([
    db.collection('users').where('userType', '==', 'sme').limit(offset + batchSize + 1).get().catch(() => ({ docs: [] })),
    storage.getAllTenders(),
    storage.getAttendanceRequests(),
  ])
  const docs = snap.docs.slice(offset, offset + batchSize)
  let updated = 0
  for (const doc of docs) {
    await buildWatchlistForSme(doc.id, { tenders, requests })
    updated += 1
  }
  const hasMore = snap.docs.length > offset + batchSize
  return {
    job: 'procurement_watchlists',
    updated,
    continuation: hasMore ? { offset: offset + batchSize } : null,
    storageCallCounts: { getAllTenders: 1, getAttendanceRequests: 1 },
  }
}

module.exports = {
  buildWatchlistForSme,
  refreshAllWatchlists,
  inferPreferencesFromHistory,
  COLLECTION: COLLECTIONS.PROCUREMENT_WATCHLISTS,
}
