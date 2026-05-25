/**
 * Predictive procurement insights from tender and request patterns.
 */
const { getStorage } = require('./storageAdapter')
const agentPerformanceService = require('./agentPerformanceService')

function monthKey(iso) {
  if (!iso) return 'unknown'
  return String(iso).slice(0, 7)
}

async function generateProcurementInsights() {
  const storage = getStorage()
  const [tenders, requests, agentRanks] = await Promise.all([
    storage.getAllTenders(),
    storage.getAttendanceRequests(),
    agentPerformanceService.rankAllAgents(),
  ])

  const provinceBriefings = {}
  const provinceRequests = {}
  const departmentCompulsory = {}
  const monthlyVolume = {}
  const smeRepeat = {}

  for (const t of tenders) {
    const p = t.province || 'Unknown'
    provinceBriefings[p] = provinceBriefings[p] || { total: 0, compulsory: 0 }
    provinceBriefings[p].total += 1
    if (t.briefingCompulsory) provinceBriefings[p].compulsory += 1

    const dept = t.department || t.organisation || 'Unknown'
    if (t.briefingCompulsory) {
      departmentCompulsory[dept] = (departmentCompulsory[dept] || 0) + 1
    }

    const mk = monthKey(t.briefingDate || t.closingDate || t.createdAt)
    monthlyVolume[mk] = (monthlyVolume[mk] || 0) + 1
  }

  for (const r of requests) {
    const p = r.province || 'Unknown'
    provinceRequests[p] = (provinceRequests[p] || 0) + 1
    if (r.smeId) {
      smeRepeat[r.smeId] = smeRepeat[r.smeId] || { count: 0, name: r.smeCompany || r.smeName }
      smeRepeat[r.smeId].count += 1
    }
  }

  const highDemandProvinces = Object.entries(provinceRequests)
    .map(([province, requestCount]) => ({
      province,
      requestCount,
      briefingCount: provinceBriefings[province]?.total || 0,
      demandRatio:
        provinceBriefings[province]?.total > 0
          ? Math.round((requestCount / provinceBriefings[province].total) * 100) / 100
          : null,
    }))
    .sort((a, b) => b.requestCount - a.requestCount)
    .slice(0, 8)

  const underServicedProvinces = Object.entries(provinceBriefings)
    .map(([province, stats]) => ({
      province,
      briefings: stats.total,
      requests: provinceRequests[province] || 0,
      gap: stats.total - (provinceRequests[province] || 0),
    }))
    .filter((x) => x.gap > 2)
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 8)

  const topCompulsoryDepartments = Object.entries(departmentCompulsory)
    .map(([department, count]) => ({ department, compulsoryBriefings: count }))
    .sort((a, b) => b.compulsoryBriefings - a.compulsoryBriefings)
    .slice(0, 10)

  const rfqPeaks = Object.entries(monthlyVolume)
    .map(([month, volume]) => ({ month, volume }))
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 6)

  const repeatSmes = Object.entries(smeRepeat)
    .filter(([, v]) => v.count >= 2)
    .map(([smeId, v]) => ({ smeId, name: v.name, requestCount: v.count }))
    .sort((a, b) => b.requestCount - a.requestCount)
    .slice(0, 10)

  return {
    generatedAt: new Date().toISOString(),
    highDemandProvinces,
    underServicedProvinces,
    topCompulsoryDepartments,
    briefingAttendanceTrend: {
      totalRequests: requests.length,
      completed: requests.filter((r) => r.status === 'completed').length,
      missed: requests.filter((r) => r.briefingMissed).length,
    },
    likelyHighVolumePeriods: rfqPeaks,
    highPerformingAgents: agentRanks.filter((a) => a.tier === 'Platinum' || a.tier === 'Gold').slice(0, 10),
    atRiskAgents: agentRanks.filter((a) => a.tier === 'At Risk').slice(0, 10),
    repeatSmeBehavior: repeatSmes,
  }
}

module.exports = {
  generateProcurementInsights,
}
