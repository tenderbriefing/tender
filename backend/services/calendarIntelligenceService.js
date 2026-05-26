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
  const tenders = await storage.getAllTenders()
  const requests = await storage.getAttendanceRequests()
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
    if (list.length >= 4) {
      overloadedAgents.push({ agentId, briefingCount: list.length, recommendation: 'delegate_or_reschedule' })
    }
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
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
          const sameDay =
            parseDate(list[i].start)?.toDateString() === parseDate(list[j].start)?.toDateString()
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
  }

  await persistInsight(INSIGHT_COLLECTION, options.docId || 'global', insight)
  return insight
}

module.exports = { analyzeCalendar, INSIGHT_COLLECTION }
