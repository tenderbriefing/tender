/**
 * Agent performance scoring and tier ranking.
 */
const { getFirestore } = require('../config/firebaseAdmin')
const { sanitizeFirestoreData } = require('../utils/sanitizeFirestoreData')
const { getStorage } = require('./storageAdapter')

const SNAPSHOT_COLLECTION = 'agentPerformanceSnapshots'

const TIERS = ['Platinum', 'Gold', 'Silver', 'At Risk']

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

function parseDate(value) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Composite performance score 0–100.
 */
function agentPerformanceScore(agent, context = {}) {
  const {
    acceptanceSpeedMinutes = null,
    completionRate = 0,
    missedBriefings = agent.missedBriefingCount ?? agent.missedMeetings ?? 0,
    smeRating = agent.rating ?? 3,
    reportUploadHours = null,
    reportingQuality = agent.reliabilityScore ?? 50,
  } = context

  let score = 50

  if (smeRating) score += clamp((smeRating - 3) * 8, -16, 16)
  score += clamp(completionRate * 25, 0, 25)
  score -= clamp(missedBriefings * 8, 0, 32)

  if (acceptanceSpeedMinutes !== null) {
    if (acceptanceSpeedMinutes <= 15) score += 12
    else if (acceptanceSpeedMinutes <= 60) score += 6
    else score -= 6
  }

  if (reportUploadHours !== null) {
    if (reportUploadHours <= 4) score += 10
    else if (reportUploadHours <= 24) score += 4
    else score -= 4
  }

  score += clamp((reportingQuality - 50) / 5, -10, 10)

  if (agent.verified) score += 4
  if (agent.transportAvailable) score += 2

  return clamp(Math.round(score), 0, 100)
}

function tierFromScore(score) {
  if (score >= 85) return 'Platinum'
  if (score >= 70) return 'Gold'
  if (score >= 50) return 'Silver'
  return 'At Risk'
}

async function buildAgentContext(agentId, requests, reports, agentDoc = null) {
  const assigned = requests.filter(
    (r) => r.assignedAgentId === agentId || r.agentId === agentId
  )
  const completed = assigned.filter((r) => r.status === 'completed')
  const missed = assigned.filter((r) => r.briefingMissed === true)

  let acceptanceSpeedMinutes = null
  const speeds = []
  for (const r of assigned) {
    if (r.acceptedAt && r.paidAt) {
      const paid = parseDate(r.paidAt)?.getTime()
      const acc = parseDate(r.acceptedAt)?.getTime()
      if (paid && acc && acc >= paid) speeds.push((acc - paid) / 60000)
    }
  }
  if (speeds.length) {
    acceptanceSpeedMinutes = speeds.reduce((a, b) => a + b, 0) / speeds.length
  }

  let reportUploadHours = null
  const uploadHours = []
  for (const rep of reports.filter((r) => r.agentId === agentId)) {
    const req = assigned.find((x) => x.id === rep.requestId)
    if (req?.briefingDate && rep.createdAt) {
      const b = parseDate(req.briefingDate)?.getTime()
      const u = parseDate(rep.createdAt)?.getTime()
      if (b && u && u >= b) uploadHours.push((u - b) / 3600000)
    }
  }
  if (uploadHours.length) {
    reportUploadHours = uploadHours.reduce((a, b) => a + b, 0) / uploadHours.length
  }

  const completionRate = assigned.length ? completed.length / assigned.length : 0

  return {
    acceptanceSpeedMinutes,
    completionRate,
    missedBriefings: missed.length,
    smeRating: null,
    reportUploadHours,
    reportingQuality: agentDoc?.reliabilityScore ?? 50,
  }
}

async function rankAllAgents() {
  const storage = getStorage()
  const db = getFirestore()
  const [agentSnap, requests, reports] = await Promise.all([
    db.collection('agents').limit(500).get(),
    storage.getAttendanceRequests(),
    storage.getBriefingReports(),
  ])

  const ranked = []
  for (const doc of agentSnap.docs) {
    const agent = { id: doc.id, ...doc.data() }
    const ctx = await buildAgentContext(agent.id, requests, reports, agent)
    const score = agentPerformanceScore(agent, ctx)
    ranked.push({
      agentId: agent.id,
      displayName: agent.displayName || agent.name || agent.email,
      province: agent.province,
      score,
      tier: tierFromScore(score),
      ...ctx,
      activeAssignments: requests.filter(
        (r) =>
          (r.assignedAgentId === agent.id || r.agentId === agent.id) &&
          ['pending', 'assigned', 'accepted'].includes(r.status)
      ).length,
    })
  }

  ranked.sort((a, b) => b.score - a.score)
  return ranked
}

async function savePerformanceSnapshots() {
  const ranked = await rankAllAgents()
  const db = getFirestore()
  const id = `snapshot-${new Date().toISOString().slice(0, 13)}`
  const doc = sanitizeFirestoreData({
    id,
    capturedAt: new Date().toISOString(),
    agentCount: ranked.length,
    agents: ranked.slice(0, 100),
    tierCounts: TIERS.reduce((acc, t) => {
      acc[t] = ranked.filter((a) => a.tier === t).length
      return acc
    }, {}),
  })
  await db.collection(SNAPSHOT_COLLECTION).doc(id).set(doc)
  return doc
}

module.exports = {
  TIERS,
  agentPerformanceScore,
  tierFromScore,
  rankAllAgents,
  savePerformanceSnapshots,
  SNAPSHOT_COLLECTION,
}
