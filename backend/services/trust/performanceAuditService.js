/**
 * Agent performance audits — reliability, lateness, complaints.
 */
const agentPerformanceService = require('../agentPerformanceService')
const { getStorage } = require('../storageAdapter')
const { nowIso } = require('../ai/_shared')

async function auditAgent(agentId) {
  const storage = getStorage()
  const [ranked, requests, reports] = await Promise.all([
    agentPerformanceService.rankAllAgents(),
    storage.getAttendanceRequests(),
    storage.getBriefingReports(),
  ])

  const rank = ranked.find((r) => r.agentId === agentId)
  const assigned = requests.filter((r) => r.agentId === agentId)
  const completed = assigned.filter((r) => r.status === 'completed')
  const missed = assigned.filter((r) => r.status === 'missed' || r.missedAt)
  const agentReports = reports.filter((r) => r.agentId === agentId)

  const late = assigned.filter((r) => {
    if (!r.briefingDate || !r.acceptedAt) return false
    return new Date(r.acceptedAt) > new Date(r.briefingDate)
  })

  return {
    agentId,
    tier: rank?.tier || 'Unknown',
    performanceScore: rank?.performanceScore ?? null,
    completedBriefings: completed.length,
    missedBriefings: missed.length,
    reportsUploaded: agentReports.length,
    lateAcceptances: late.length,
    smeComplaints: 0,
    auditAt: nowIso(),
    recommendations:
      missed.length > 2
        ? ['Review agent tier', 'Require re-verification']
        : ['Maintain current tier'],
  }
}

async function auditAllAgents(limit = 30) {
  const ranked = await agentPerformanceService.rankAllAgents()
  const audits = []
  for (const r of ranked.slice(0, limit)) {
    audits.push(await auditAgent(r.agentId))
  }
  return audits
}

module.exports = { auditAgent, auditAllAgents }
