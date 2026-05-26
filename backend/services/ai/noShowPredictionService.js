/**
 * AI no-show prevention — movement, GPS, ETA, lateness patterns.
 */
const { getFirestore } = require('../../config/firebaseAdmin')
const { persistInsight, nowIso, clamp } = require('./_shared')
const COLLECTIONS = require('./autonomousCollections')

function parseDate(v) {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

async function loadGpsActivity(agentId, requestId) {
  const db = getFirestore()
  let snap = await db
    .collection('gpsAttendanceLogs')
    .where('agentId', '==', agentId)
    .limit(40)
    .get()
    .catch(() => ({ docs: [] }))
  const events = snap.docs.map((d) => d.data())
  if (requestId) {
    const forReq = events.filter((e) => e.requestId === requestId)
    if (forReq.length) return forReq
  }
  return events
}

async function predictNoShow(request, agent = null) {
  const agentId = agent?.id || request.assignedAgentId || request.agentId
  const riskFactors = []
  let score = 0

  const briefingAt = parseDate(request.briefingDate)
  if (briefingAt) {
    const hoursUntil = (briefingAt.getTime() - Date.now()) / 3600000
    if (hoursUntil < 2 && hoursUntil > 0) {
      score += 15
      riskFactors.push('briefing_imminent')
    }
    if (hoursUntil < 0) {
      score += 25
      riskFactors.push('briefing_past_due')
    }
  }

  if (!agentId) {
    score += 20
    riskFactors.push('no_agent_assigned')
  } else {
    const missed = agent?.missedBriefingCount ?? agent?.missedMeetings ?? 0
    if (missed >= 2) {
      score += 25
      riskFactors.push('repeated_lateness_history')
    }
    const reliability = agent?.reliabilityScore ?? 50
    if (reliability < 40) {
      score += 15
      riskFactors.push('low_reliability_score')
    }

    const gps = await loadGpsActivity(agentId, request.id)
    const recent = gps.filter((e) => {
      const t = parseDate(e.serverTimestamp || e.timestamp)
      return t && Date.now() - t.getTime() < 6 * 3600000
    })
    if (!recent.length && request.status === 'accepted') {
      score += 20
      riskFactors.push('no_gps_activity')
    }
    const checkIns = recent.filter((e) => e.eventType === 'check_in')
    if (request.status === 'accepted' && briefingAt) {
      const minsToBriefing = (briefingAt.getTime() - Date.now()) / 60000
      if (minsToBriefing < 90 && minsToBriefing > 0 && !checkIns.length) {
        score += 18
        riskFactors.push('late_movement')
      }
    }
    if (request.etaMissedAt || request.slaEscalated) {
      score += 22
      riskFactors.push('missed_eta')
    }
  }

  if (request.briefingCompulsory || request.compulsoryBriefing) {
    score += 8
    riskFactors.push('compulsory_briefing')
  }

  const confidence = clamp(score / 100, 0.15, 0.95)
  const predictedNoShow = score >= 45

  let recommendedAction = 'monitor'
  if (score >= 70) recommendedAction = 'dispatch_backup_agent'
  else if (score >= 50) recommendedAction = 'notify_sme_and_admin'
  else if (score >= 35) recommendedAction = 'escalate_urgency'

  const result = {
    requestId: request.id,
    agentId: agentId || null,
    predictedNoShow,
    confidence: Math.round(confidence * 100) / 100,
    riskScore: clamp(score, 0, 100),
    riskFactors,
    recommendedAction,
    predictedAt: nowIso(),
    aiProvider: 'rule-based',
  }

  await persistInsight(COLLECTIONS.ATTENDANCE_RISK_PREDICTIONS, String(request.id), result)
  return result
}

async function runNoShowSweep() {
  const { getStorage } = require('../storageAdapter')
  const requests = await getStorage().getAttendanceRequests()
  const db = getFirestore()
  const agentSnap = await db.collection('agents').limit(300).get().catch(() => ({ docs: [] }))
  const agentsById = Object.fromEntries(agentSnap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]))

  let highRisk = 0
  let actions = 0
  for (const request of requests) {
    if (!['pending', 'assigned', 'accepted'].includes(request.status)) continue
    const agent = agentsById[request.assignedAgentId || request.agentId]
    const pred = await predictNoShow(request, agent)
    if (pred.predictedNoShow) highRisk += 1
    if (pred.recommendedAction === 'dispatch_backup_agent' && request.paymentStatus === 'paid') {
      try {
        const liveDispatch = require('../liveDispatchService')
        await liveDispatch.autoDispatchRequest(request, {
          radiusKm: 100,
          provinceWide: false,
          reason: 'no_show_backup',
        })
        actions += 1
      } catch {
        /* non-fatal */
      }
    }
  }
  return { job: 'no_show_prediction', scanned: requests.length, highRisk, backupDispatches: actions }
}

module.exports = { predictNoShow, runNoShowSweep, COLLECTION: COLLECTIONS.ATTENDANCE_RISK_PREDICTIONS }
