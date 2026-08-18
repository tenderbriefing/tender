/**
 * Precomputed catalogue KPIs written by tender sync (category 5 — background).
 * Interactive stats/home paths MUST read this document (or Firestore count())
 * instead of getAllTenders() on every poll.
 */
const { getFirestore } = require('../config/firebaseAdmin')
const { sanitizeFirestoreData } = require('../utils/sanitizeFirestoreData')

const COLLECTION = 'platformStats'
const DOC_ID = 'catalogue'

function daysUntil(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return null
  return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

function isUpcomingBriefing(tender, now = Date.now()) {
  if (tender.visibility === 'private') return false
  if (tender.briefingCompulsory !== true) return false
  const raw = tender.briefingDate
  if (!raw) return false
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return false
  return d.getTime() >= now - 12 * 60 * 60 * 1000
}

function buildCatalogueSummaryFromTenders(tenders = [], extras = {}) {
  const now = Date.now()
  const compulsory = tenders.filter((t) => t.briefingCompulsory === true && t.visibility !== 'private')
  const upcoming = compulsory.filter((t) => isUpcomingBriefing(t, now))
  const departmentCounts = {}
  const provinces = new Set()
  for (const tender of upcoming) {
    if (tender.department) {
      departmentCounts[tender.department] = (departmentCounts[tender.department] || 0) + 1
    }
    if (tender.province) provinces.add(tender.province)
  }
  const topDepartments = Object.entries(departmentCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  return {
    source: 'sync_precompute',
    updatedAt: new Date().toISOString(),
    tenderCount: tenders.length,
    compulsoryBriefings: compulsory.length,
    totalBriefings: upcoming.length,
    closingWithin7Days: upcoming.filter((t) => {
      const days = daysUntil(t.closingDate)
      return days !== null && days >= 0 && days <= 7
    }).length,
    provincesRepresented: Array.from(provinces).sort(),
    topDepartments,
    ...extras,
  }
}

async function writeCatalogueSummary(tenders, extras = {}) {
  const payload = sanitizeFirestoreData(buildCatalogueSummaryFromTenders(tenders, extras))
  try {
    const db = getFirestore()
    await db.collection(COLLECTION).doc(DOC_ID).set(payload, { merge: true })
  } catch (err) {
    console.warn(
      JSON.stringify({
        event: 'catalogue_summary_write_failed',
        error: err instanceof Error ? err.message.slice(0, 160) : 'unknown',
      })
    )
  }
  return payload
}

async function readCatalogueSummary() {
  try {
    const db = getFirestore()
    const snap = await db.collection(COLLECTION).doc(DOC_ID).get()
    if (!snap.exists) return null
    return { id: snap.id, ...snap.data() }
  } catch {
    return null
  }
}

module.exports = {
  COLLECTION,
  DOC_ID,
  buildCatalogueSummaryFromTenders,
  writeCatalogueSummary,
  readCatalogueSummary,
  isUpcomingBriefing,
}
