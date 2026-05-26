/**
 * Daily procurement brief — SMEs and agents (WhatsApp, push, dashboard).
 */
const { getFirestore } = require('../../config/firebaseAdmin')
const { persistInsight, nowIso, daysUntil } = require('./_shared')
const { getStorage } = require('../storageAdapter')
const watchlist = require('./procurementWatchlistService')
const submissionReadiness = require('./submissionReadinessService')
const COLLECTIONS = require('./autonomousCollections')

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

async function buildSmeBrief(smeUid) {
  const storage = getStorage()
  const tenders = (await storage.getAllTenders()).filter(
    (t) => t.visibility !== 'private' || t.ownerUid === smeUid
  )
  const requests = (await storage.getAttendanceRequests()).filter((r) => r.smeId === smeUid)
  let wl = null
  try {
    wl = await watchlist.buildWatchlistForSme(smeUid)
  } catch {
    wl = { matchingOpportunities: [] }
  }
  let readiness = null
  try {
    readiness = await submissionReadiness.evaluateSubmissionReadiness(smeUid)
  } catch {
    readiness = { readinessScore: 0, missingDocumentChecklist: [] }
  }

  const deadlines = tenders
    .filter((t) => t.closingDate && daysUntil(t.closingDate) != null && daysUntil(t.closingDate) <= 7)
    .slice(0, 8)
    .map((t) => ({
      tenderId: t.id,
      title: t.title,
      closingDate: t.closingDate,
      daysLeft: daysUntil(t.closingDate),
    }))

  return {
    audience: 'sme',
    smeUid,
    topOpportunities: (wl.matchingOpportunities || []).slice(0, 5),
    deadlines,
    missingCompliance: readiness.missingDocumentChecklist || [],
    aiRecommendations: readiness.submissionRecommendations || [],
    qualificationProbability: Math.round((readiness.readinessScore || 50) / 100 * 100) / 100,
    activeRequests: requests.filter((r) => ['pending', 'assigned', 'accepted'].includes(r.status)).length,
  }
}

async function buildAgentBrief(agentId) {
  const storage = getStorage()
  const requests = (await storage.getAttendanceRequests()).filter(
    (r) =>
      (r.assignedAgentId === agentId || r.agentId === agentId) &&
      ['assigned', 'accepted', 'pending'].includes(r.status)
  )
  const schedule = requests
    .filter((r) => r.briefingDate)
    .map((r) => ({
      requestId: r.id,
      title: r.tenderTitle || r.tenderNumber,
      briefingDate: r.briefingDate,
      province: r.province,
      venue: r.briefingVenue,
      quotedFee: r.quotedFee || r.paymentAmount,
    }))
    .slice(0, 10)

  const expectedEarnings = schedule.reduce((s, r) => s + (Number(r.quotedFee) || 0), 0)

  return {
    audience: 'agent',
    agentId,
    briefingSchedule: schedule,
    optimizedRouteHint: schedule.length > 1 ? 'Group briefings by province for efficiency' : null,
    expectedEarnings,
    trafficRisks: schedule.length >= 3 ? ['Multiple same-day briefings — check travel time'] : [],
    backupOpportunities: requests.filter((r) => r.status === 'pending' && !r.assignedAgentId).length,
  }
}

async function runDailyProcurementBrief(options = {}) {
  const storage = getStorage()
  const db = getFirestore()
  const date = todayKey()
  const briefId = `daily-${date}`

  const smeSnap = await db.collection('users').where('userType', '==', 'sme').limit(options.smeLimit || 30).get().catch(() => ({ docs: [] }))
  const agentSnap = await db.collection('agents').limit(options.agentLimit || 30).get().catch(() => ({ docs: [] }))

  const smeBriefs = []
  for (const doc of smeSnap.docs) {
    smeBriefs.push(await buildSmeBrief(doc.id))
  }
  const agentBriefs = []
  for (const doc of agentSnap.docs) {
    agentBriefs.push(await buildAgentBrief(doc.id))
  }

  const payload = {
    date,
    job: 'daily_procurement_brief',
    smeBriefs,
    agentBriefs,
    channels: ['dashboard', 'whatsapp', 'push', 'email'],
    generatedAt: nowIso(),
    aiProvider: 'rule-based',
  }

  await persistInsight(COLLECTIONS.DAILY_PROCUREMENT_BRIEFS, briefId, payload)

  if (!options.skipNotifications) {
    const notificationService = require('../notificationService')
    for (const brief of smeBriefs.slice(0, 5)) {
      if (!brief.deadlines?.length && !brief.topOpportunities?.length) continue
      try {
        await notificationService.notify('tender_closing_soon', {
          smeId: brief.smeUid,
          idempotencySuffix: `daily-brief-${date}`,
          summary: `${brief.topOpportunities.length} matches, ${brief.deadlines.length} deadlines today`,
        })
      } catch {
        /* non-fatal */
      }
    }
  }

  return { ...payload, id: briefId }
}

module.exports = {
  runDailyProcurementBrief,
  buildSmeBrief,
  buildAgentBrief,
  COLLECTION: COLLECTIONS.DAILY_PROCUREMENT_BRIEFS,
}
