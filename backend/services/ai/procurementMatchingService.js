/**
 * AI-style procurement matching — SME↔tender, agent↔briefing, province↔demand.
 */
const { getFirestore } = require('../../config/firebaseAdmin')
const { getStorage } = require('../storageAdapter')
const liveDispatch = require('../liveDispatchService')
const opportunityScoring = require('./opportunityScoringService')
const { clamp } = require('./_shared')

async function matchSmeToTenders(smeId, limit = 10) {
  const db = getFirestore()
  const storage = getStorage()
  const [smeDoc, tenders] = await Promise.all([
    db.collection('smes').doc(smeId).get(),
    storage.getAllTenders(),
  ])
  const sme = smeDoc.exists ? smeDoc.data() : {}
  const compulsory = tenders.filter((t) => t.briefingCompulsory !== false)

  const ranked = compulsory
    .map((t) => {
      const scores = opportunityScoring.scoreTenderOpportunity(t, sme)
      return {
        tenderId: t.id,
        tenderNumber: t.tenderNumber,
        title: t.title,
        province: t.province,
        matchScore: scores.smeSuitabilityScore,
        urgencyScore: scores.urgencyScore,
      }
    })
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, limit)

  return { smeId, matches: ranked }
}

async function matchAgentToBriefing(request) {
  const agents = await liveDispatch.findBestAgentsForRequest(request, { limit: 8 })
  return {
    requestId: request.id,
    matches: agents.map((a) => ({
      agentId: a.agentId,
      dispatchScore: a.dispatchScore,
      province: a.province,
      distanceKm: a.distanceKm,
      tier: a.tier,
    })),
  }
}

async function matchProvinceDemand() {
  const storage = getStorage()
  const requests = await storage.getAttendanceRequests()
  const demand = {}
  for (const r of requests) {
    const p = r.province || 'Unknown'
    demand[p] = (demand[p] || 0) + 1
  }
  return Object.entries(demand)
    .map(([province, count]) => ({ province, demand: count }))
    .sort((a, b) => b.demand - a.demand)
}

async function matchSectorOpportunity() {
  const storage = getStorage()
  const tenders = await storage.getAllTenders()
  const sectors = {}
  for (const t of tenders) {
    const s = t.industrySector || 'General'
    sectors[s] = (sectors[s] || 0) + 1
  }
  return Object.entries(sectors)
    .map(([sector, count]) => ({ sector, opportunities: count }))
    .sort((a, b) => b.opportunities - a.opportunities)
    .slice(0, 15)
}

module.exports = {
  matchSmeToTenders,
  matchAgentToBriefing,
  matchProvinceDemand,
  matchSectorOpportunity,
}
