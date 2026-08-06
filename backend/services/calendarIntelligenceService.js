/**
 * AI calendar automation — conflicts, workload, travel risk, delegation.
 */
const calendarService = require('./calendarService')
const { getStorage } = require('./storageAdapter')
const { persistInsight, nowIso, clamp, haversineKm } = require('./ai/_shared')

const INSIGHT_COLLECTION = 'calendarIntelligenceInsights'

function parseDate(v) {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

function eventsOverlap(a, b) {
  const startA = parseDate(a.start || a.briefingDate)
  const startB = parseDate(b.start || b.briefingDate)
  if (!startA || !startB) return false
  const endA = new Date(startA.getTime() + (a.durationMinutes || 120) * 60000)
  const endB = new Date(startB.getTime() + (b.durationMinutes || 120) * 60000)
  return startA < endB && startB < endA
}

async function analyzeCalendar(options = {}) {
  const storage = getStorage()
  const offset = Math.max(0, Number(options.offset) || 0)
  const batchSize = Math.max(1, Math.min(Number(options.batchSize) || 200, 500))
  const [allTenders, allRequests] = await Promise.all([
    storage.getAllTenders(),
    storage.getAttendanceRequests(),
  ])
  const tenders = allTenders.slice(0, Math.max(100, Number(options.tenderLimit) || 2_000))
  const requests = allRequests.slice(offset, offset + batchSize)
  const events = tenders
    .flatMap((t) => {
      const built = calendarService.buildCalendarEvents(t)
      return built.calendarEvents || []
    })
    .map((e) => ({
      id: e.id,
      title: e.title,
      start: e.start,
      province: e.location,
      durationMinutes: 120,
    }))

  const agentEvents = {}
  for (const req of requests) {
    const aid = req.assignedAgentId || req.agentId
    if (!aid || !req.briefingDate) continue
    if (!agentEvents[aid]) agentEvents[aid] = []
    agentEvents[aid].push({
      id: req.id,
      title: req.tenderTitle || req.tenderNumber,
      start: req.briefingDate,
      province: req.province,
      latitude: req.latitude,
      longitude: req.longitude,
    })
  }

  const conflicts = []
  const overloadedAgents = []
  const travelRisks = []

  for (const [agentId, list] of Object.entries(agentEvents)) {
    list.sort((a, b) => (parseDate(a.start)?.getTime() || 0) - (parseDate(b.start)?.getTime() || 0))
    if (list.length >= 4) {
      overloadedAgents.push({ agentId, briefingCount: list.length, recommendation: 'delegate_or_reschedule' })
    }
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const startI = parseDate(list[i].start)
        const startJ = parseDate(list[j].start)
        if (!startI || !startJ) continue
        // Sorted sliding window: events on later days cannot overlap or pose a
        // same-day travel risk, so stop instead of comparing every pair.
        if (startJ.getTime() - startI.getTime() > 24 * 60 * 60 * 1000) break
        if (eventsOverlap(list[i], list[j])) {
          conflicts.push({
            agentId,
            eventA: list[i].id,
            eventB: list[j].id,
            type: 'schedule_conflict',
          })
        }
        if (list[i].latitude && list[j].latitude) {
          const km = haversineKm(
            list[i].latitude,
            list[i].longitude,
            list[j].latitude,
            list[j].longitude
          )
          const sameDay = startI.toDateString() === startJ.toDateString()
          if (sameDay && km != null && km > 80) {
            travelRisks.push({
              agentId,
              distanceKm: km,
              recommendation: 'alternate_agent_or_reschedule',
            })
          }
        }
      }
    }
  }

  const briefingPressure = events.filter((e) => {
    const d = parseDate(e.start)
    if (!d) return false
    const days = (d.getTime() - Date.now()) / 86400000
    return days >= 0 && days <= 7
  }).length

  const insight = {
    generatedAt: nowIso(),
    procurementWorkloadScore: clamp(events.length * 2, 0, 100),
    travelRiskScore: clamp(travelRisks.length * 15, 0, 100),
    briefingPressureIndicators: {
      next7Days: briefingPressure,
      level: briefingPressure > 20 ? 'high' : briefingPressure > 8 ? 'medium' : 'low',
    },
    impossibleSchedules: conflicts,
    overloadedAgents,
    travelConflicts: travelRisks,
    delegationRecommendations: overloadedAgents.map((o) => ({
      agentId: o.agentId,
      action: 'assign_backup_agent',
    })),
    aiProvider: 'rule-based',
    batch: { offset, batchSize, processed: requests.length, total: allRequests.length },
  }

  await persistInsight(INSIGHT_COLLECTION, options.docId || 'global', insight)
  return {
    ...insight,
    continuation: offset + requests.length < allRequests.length
      ? { offset: offset + requests.length }
      : null,
    storageCallCounts: { getAllTenders: 1, getAttendanceRequests: 1 },
  }
}

module.exports = { analyzeCalendar, INSIGHT_COLLECTION }
