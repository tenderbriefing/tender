/**
 * Live dispatch engine — real-time agent matching and smart dispatch automation.
 */
const { getFirestore } = require('../config/firebaseAdmin')
const { sanitizeFirestoreData } = require('../utils/sanitizeFirestoreData')
const { getStorage } = require('./storageAdapter')
const agentPerformanceService = require('./agentPerformanceService')
const workflowAutomationService = require('./workflowAutomationService')

const DISPATCH_COLLECTION = 'dispatchEvents'
const SLA_BREACH_COLLECTION = 'slaBreaches'
const WORKFLOW_FAILURE_COLLECTION = 'workflowFailures'

const DEFAULT_RADIUS_KM = 50
const AUTO_DISPATCH_TOP_N = 5
const STALE_REQUEST_DAYS = 14

function nowIso() {
  return new Date().toISOString()
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180
  const R = 6371
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function parseDate(value) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function briefingUrgencyScore(request) {
  const briefingAt = parseDate(request.briefingDate)
  if (!briefingAt) return 0
  const hours = (briefingAt.getTime() - Date.now()) / 3600000
  if (hours < 0) return 30
  if (hours <= 24) return 25
  if (hours <= 72) return 15
  if (hours <= 168) return 8
  return 2
}

function computeDispatchScore(agent, request, context = {}) {
  const {
    distanceKm = null,
    activeWorkload = 0,
    performanceScore = 50,
    tier = 'Silver',
  } = context

  let score = performanceScore

  if (distanceKm !== null) {
    if (distanceKm <= 10) score += 20
    else if (distanceKm <= 25) score += 12
    else if (distanceKm <= 50) score += 5
    else score -= Math.min(15, Math.floor(distanceKm / 20))
  }

  if (agent.province && request.province && agent.province === request.province) {
    score += 12
  }

  const reliability = agent.reliabilityScore ?? 50
  score += (reliability - 50) / 5

  const completed = agent.completedBriefingCount ?? 0
  score += Math.min(10, completed / 2)

  const missed = agent.missedBriefingCount ?? agent.missedMeetings ?? 0
  score -= missed * 6

  if (agent.availability === 'available') score += 8
  else if (agent.availability === 'busy') score -= 10

  if (agent.transportAvailable) score += 4

  score -= activeWorkload * 3
  score += briefingUrgencyScore(request)

  if (tier === 'Platinum') score += 8
  else if (tier === 'Gold') score += 4
  else if (tier === 'At Risk') score -= 12

  return Math.round(Math.max(0, Math.min(100, score)))
}

async function loadAgents() {
  const db = getFirestore()
  const snap = await db.collection('agents').limit(500).get()
  return snap.docs.map((d) => ({ id: d.id, ...d.data(), userType: 'youth-agent' }))
}

function countActiveWorkload(agentId, requests) {
  return requests.filter(
    (r) =>
      (r.assignedAgentId === agentId || r.agentId === agentId) &&
      ['assigned', 'accepted', 'pending'].includes(r.status) &&
      r.status !== 'completed'
  ).length
}

/**
 * Find best agents for a request with full scoring breakdown.
 */
async function findBestAgentsForRequest(request, options = {}) {
  const radiusKm = options.radiusKm ?? request.radiusKm ?? DEFAULT_RADIUS_KM
  const limit = options.limit ?? AUTO_DISPATCH_TOP_N
  const provinceWide = options.provinceWide === true

  const agents = await loadAgents()
  const storage = getStorage()
  const allRequests = await storage.getAttendanceRequests()
  const performanceRanked = await agentPerformanceService.rankAllAgents()
  const perfById = Object.fromEntries(performanceRanked.map((a) => [a.agentId, a]))

  const candidates = []

  for (const agent of agents) {
    if ((agent.missedBriefingCount ?? agent.missedMeetings ?? 0) >= 3) continue
    if (agent.availability === 'offline') continue

    let distanceKm = null
    if (
      agent.latitude &&
      agent.longitude &&
      request.latitude &&
      request.longitude
    ) {
      distanceKm = haversineKm(
        agent.latitude,
        agent.longitude,
        request.latitude,
        request.longitude
      )
      if (!provinceWide && distanceKm > radiusKm) continue
    } else if (!provinceWide && request.province && agent.province !== request.province) {
      continue
    }

    const perf = perfById[agent.id] || {}
    const dispatchScore = computeDispatchScore(agent, request, {
      distanceKm,
      activeWorkload: countActiveWorkload(agent.id, allRequests),
      performanceScore: perf.score ?? 50,
      tier: perf.tier ?? 'Silver',
    })

    candidates.push({
      agentId: agent.id,
      displayName: agent.displayName || agent.name || agent.email,
      province: agent.province,
      dispatchScore,
      distanceKm,
      tier: perf.tier ?? 'Silver',
      performanceScore: perf.score ?? 50,
      availability: agent.availability,
      transportAvailable: !!agent.transportAvailable,
      activeWorkload: countActiveWorkload(agent.id, allRequests),
    })
  }

  candidates.sort((a, b) => b.dispatchScore - a.dispatchScore)
  return candidates.slice(0, limit)
}

async function logDispatchEvent(patch) {
  const db = getFirestore()
  const id = patch.id || `dispatch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const doc = sanitizeFirestoreData({
    ...patch,
    id,
    createdAt: patch.createdAt || nowIso(),
  })
  await db.collection(DISPATCH_COLLECTION).doc(id).set(doc)
  return doc
}

async function logSlaBreach(patch) {
  const db = getFirestore()
  const id = patch.id || `sla-${patch.requestId}-${patch.breachType}`
  const doc = sanitizeFirestoreData({ ...patch, id, detectedAt: nowIso() })
  await db.collection(SLA_BREACH_COLLECTION).doc(id).set(doc, { merge: true })
  return doc
}

async function autoDispatchRequest(request, { radiusKm, provinceWide, reason }) {
  const matches = await findBestAgentsForRequest(request, {
    radiusKm,
    provinceWide,
    limit: AUTO_DISPATCH_TOP_N,
  })
  const agentIds = matches.map((m) => m.agentId)
  const storage = getStorage()
  const existing = new Set(request.notifiedAgents || [])
  const merged = [...existing, ...agentIds.filter((id) => !existing.has(id))]

  const updated = {
    ...request,
    notifiedAgents: merged.slice(0, 15),
    lastDispatchAt: nowIso(),
    dispatchRadiusKm: radiusKm ?? request.radiusKm,
    updatedAt: nowIso(),
  }
  await storage.saveAttendanceRequest(updated)

  await logDispatchEvent({
    requestId: request.id,
    type: 'auto_dispatch',
    reason: reason || 'smart_dispatch',
    agentIds: matches.map((m) => m.agentId),
    scores: matches.map((m) => ({
      agentId: m.agentId,
      dispatchScore: m.dispatchScore,
      tier: m.tier,
    })),
    radiusKm: radiusKm ?? request.radiusKm,
    provinceWide: !!provinceWide,
  })

  if (agentIds.length && request.paymentStatus === 'paid') {
    await workflowAutomationService.dispatchWorkflowEvent('attendance_requested', {
      ...updated,
      id: request.id,
      requestId: request.id,
      idempotencySuffix: `dispatch-${reason}`,
    })
  }

  return { request: updated, matches }
}

async function runSmartDispatchAutomation() {
  const storage = getStorage()
  const requests = await storage.getAttendanceRequests()
  const now = Date.now()
  let top5Dispatched = 0
  let radiusEscalations = 0
  let provinceEscalations = 0
  let staleClosed = 0
  let slaMarked = 0

  for (const request of requests) {
    if (request.status !== 'pending') continue
    if (request.paymentStatus !== 'paid') continue

    const paidAt = parseDate(request.paidAt || request.createdAt)
    if (!paidAt) continue
    const minutesWaiting = (now - paidAt.getTime()) / 60000

    if (minutesWaiting >= 30 && !request.dispatchProvinceWideAt) {
      await autoDispatchRequest(request, {
        radiusKm: 200,
        provinceWide: true,
        reason: 'province_30m',
      })
      request.dispatchProvinceWideAt = nowIso()
      provinceEscalations += 1
      continue
    }

    if (minutesWaiting >= 15 && !request.dispatchWiderAt) {
      await autoDispatchRequest(request, {
        radiusKm: 100,
        provinceWide: false,
        reason: 'radius_15m',
      })
      request.dispatchWiderAt = nowIso()
      radiusEscalations += 1
      continue
    }

    if (!request.lastDispatchAt && (!request.notifiedAgents || !request.notifiedAgents.length)) {
      await autoDispatchRequest(request, {
        radiusKm: request.radiusKm || DEFAULT_RADIUS_KM,
        reason: 'initial_top5',
      })
      top5Dispatched += 1
      continue
    }

    if (minutesWaiting >= 60 && !request.slaBreachLoggedAt) {
      await logSlaBreach({
        requestId: request.id,
        breachType: 'acceptance_60m',
        smeId: request.smeId,
        province: request.province,
        minutesWaiting: Math.round(minutesWaiting),
      })
      request.slaBreachLoggedAt = nowIso()
      await storage.saveAttendanceRequest(request)
      slaMarked += 1
    }
  }

  const staleCutoff = now - STALE_REQUEST_DAYS * 24 * 60 * 60 * 1000
  for (const request of requests) {
    if (request.status !== 'pending') continue
    const created = parseDate(request.createdAt)
    if (!created || created.getTime() > staleCutoff) continue
    if (request.paymentStatus === 'paid') continue
    await storage.saveAttendanceRequest({
      ...request,
      status: 'declined',
      staleClosedAt: nowIso(),
      updatedAt: nowIso(),
      notes: `${request.notes || ''} [auto-closed stale]`.trim(),
    })
    staleClosed += 1
  }

  return {
    job: 'smart_dispatch',
    top5Dispatched,
    radiusEscalations,
    provinceEscalations,
    staleClosed,
    slaMarked,
  }
}

module.exports = {
  findBestAgentsForRequest,
  computeDispatchScore,
  runSmartDispatchAutomation,
  logDispatchEvent,
  logSlaBreach,
  autoDispatchRequest,
  DISPATCH_COLLECTION,
  SLA_BREACH_COLLECTION,
  WORKFLOW_FAILURE_COLLECTION,
}
