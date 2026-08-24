/**
 * Operations command center — live ops payload for admin UI.
 *
 * This endpoint is polled from /admin/operations (every ~45s) behind Firebase
 * Hosting’s 60s Cloud Run rewrite. The previous implementation fan-out to
 * getAllTenders, rankAllAgents, findBestAgentsForRequest (×8, each re-ranking
 * and scoring fraud), getAiOpsExtension, and PI dashboard — which OOMs the 1Gi
 * Cloud Run instance and surfaces as a browser 503 on `command-center`.
 *
 * Keep this path bounded: reuse already-fetched requests/agents, never scan
 * the full tender collection, and cache briefly so stacked polls share work.
 */
const { getFirestore } = require('../config/firebaseAdmin')
const { getStorage } = require('./storageAdapter')
const agentPerformanceService = require('./agentPerformanceService')
const workflowAutomationService = require('./workflowAutomationService')
const whatsappService = require('./whatsappService')

const CACHE_TTL_MS = Number(process.env.COMMAND_CENTER_CACHE_TTL_MS || 20000)

let cacheEntry = null
let cacheAt = 0
let inflight = null

function parseDate(value) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function settled(promise, fallback) {
  return Promise.resolve(promise).then(
    (value) => value,
    () => fallback
  )
}

function rankAgentsLight(agents, requests) {
  return agents
    .map((agent) => {
      const assigned = requests.filter(
        (r) => r.assignedAgentId === agent.id || r.agentId === agent.id
      )
      const completed = assigned.filter((r) => r.status === 'completed')
      const missed = assigned.filter((r) => r.briefingMissed === true)
      const score = agentPerformanceService.agentPerformanceScore(agent, {
        completionRate: assigned.length ? completed.length / assigned.length : 0,
        missedBriefings: missed.length,
        smeRating: agent.rating ?? 3,
        reportingQuality: agent.reliabilityScore ?? 50,
      })
      return {
        agentId: agent.id,
        displayName: agent.displayName || agent.name || agent.email,
        province: agent.province,
        score,
        tier: agentPerformanceService.tierFromScore(score),
        lat: agent.latitude,
        lng: agent.longitude,
        availability: agent.availability,
      }
    })
    .sort((a, b) => b.score - a.score)
}

function paidAmountCents(record) {
  const amount = Number(record.paymentAmount)
  if (Number.isFinite(amount) && amount > 0) return Math.round(amount)
  const snap = Number(record.briefingPriceCents)
  if (Number.isFinite(snap) && snap > 0) return Math.round(snap)
  const quoted = Number(record.quotedFee)
  if (Number.isFinite(quoted) && quoted > 0) return Math.round(quoted)
  return 0
}

function liveExecutive(requests, waStats) {
  const today = new Date().toISOString().slice(0, 10)
  const paid = requests.filter((r) => r.paymentStatus === 'paid')
  const pendingPaid = requests.filter((r) => r.status === 'pending' && r.paymentStatus === 'paid')
  const revenueTodayCents = paid
    .filter((r) => r.paidAt && String(r.paidAt).startsWith(today))
    .reduce((s, r) => s + paidAmountCents(r), 0)
  const conversionPct =
    requests.length > 0 ? Math.round((paid.length / requests.length) * 1000) / 10 : 0
  const waSent = waStats.sent || 0
  const waFailed = waStats.failed || 0
  const waTotal = waSent + waFailed
  return {
    revenueTodayCents,
    paidRequests: paid.length,
    conversionPct,
    whatsappSuccessRate: waTotal > 0 ? Math.round((waSent / waTotal) * 1000) / 10 : null,
    pendingPaidRequests: pendingPaid.length,
  }
}

function buildDispatchBoard(pendingQueue, ranked) {
  return pendingQueue.slice(0, 8).map((req) => {
    const sameProvince = ranked.filter((a) => a.province && a.province === req.province)
    const pool = sameProvince.length ? sameProvince : ranked
    return {
      requestId: req.id,
      tenderNumber: req.tenderNumber,
      province: req.province,
      paidAt: req.paidAt,
      notifiedCount: (req.notifiedAgents || []).length,
      topAgents: pool.slice(0, 5).map((a) => ({
        agentId: a.agentId,
        displayName: a.displayName,
        dispatchScore: a.score,
        tier: a.tier,
        distanceKm: null,
      })),
    }
  })
}

function buildSlaHeatmap(requests, now) {
  const slaHeatmap = {}
  for (const r of requests.filter((row) => row.status === 'pending' && row.paymentStatus === 'paid')) {
    const paidAt = parseDate(r.paidAt)
    if (!paidAt) continue
    const mins = (now - paidAt.getTime()) / 60000
    const bucket =
      mins >= 60 ? 'critical' : mins >= 30 ? 'high' : mins >= 15 ? 'medium' : 'normal'
    const p = r.province || 'Unknown'
    if (!slaHeatmap[p]) slaHeatmap[p] = { normal: 0, medium: 0, high: 0, critical: 0 }
    slaHeatmap[p][bucket] += 1
  }
  return slaHeatmap
}

function buildCommandCenterPayload({
  requests = [],
  agents = [],
  waStats = {},
  workflowTelemetry = {},
  dispatchSnap = [],
  slaSnap = [],
  workflowFailSnap = [],
  now = Date.now(),
} = {}) {
  const ranked = rankAgentsLight(agents, requests)
  const pendingQueue = requests
    .filter((r) => r.status === 'pending' && r.paymentStatus === 'paid')
    .sort((a, b) => new Date(a.paidAt || a.createdAt) - new Date(b.paidAt || b.createdAt))
    .slice(0, 25)

  const paymentPipeline = {
    pending: requests.filter((r) => r.paymentStatus === 'pending').length,
    paid: requests.filter((r) => r.paymentStatus === 'paid').length,
    failed: requests.filter((r) => r.paymentStatus === 'failed').length,
    cancelled: requests.filter((r) => r.paymentStatus === 'cancelled').length,
  }

  const highDemandProvinces = Object.entries(
    requests.reduce((acc, r) => {
      const p = r.province || 'Unknown'
      acc[p] = (acc[p] || 0) + 1
      return acc
    }, {})
  )
    .map(([province, requestCount]) => ({ province, requestCount }))
    .sort((a, b) => b.requestCount - a.requestCount)
    .slice(0, 5)

  return {
    generatedAt: new Date(now).toISOString(),
    aiOps: null,
    procurementIntelligence: null,
    dispatchBoard: buildDispatchBoard(pendingQueue, ranked),
    pendingQueue: pendingQueue.map((r) => ({
      id: r.id,
      tenderNumber: r.tenderNumber,
      province: r.province,
      smeCompany: r.smeCompany,
      paidAt: r.paidAt,
      notifiedAgents: (r.notifiedAgents || []).length,
      minutesWaiting: r.paidAt
        ? Math.round((now - (parseDate(r.paidAt)?.getTime() || now)) / 60000)
        : null,
    })),
    activeAgentsMap: ranked
      .filter((a) => a.lat && a.lng)
      .map((a) => ({
        id: a.agentId,
        name: a.displayName,
        province: a.province,
        lat: a.lat,
        lng: a.lng,
        availability: a.availability,
        tier: a.tier,
      })),
    slaHeatmap: buildSlaHeatmap(requests, now),
    whatsappStream: (waStats.latest || [])
      .filter((n) => n.channel === 'whatsapp' || n.status)
      .slice(0, 20)
      .map((n) => ({
        id: n.id,
        status: n.status,
        type: n.type,
        createdAt: n.createdAt,
        recipientRole: n.recipientRole,
      })),
    whatsappSummary: {
      configured: whatsappService.isConfigured(),
      sent: waStats.sent || 0,
      failed: waStats.failed || 0,
      pending: waStats.pending || 0,
    },
    paymentPipeline,
    workflowTimeline: workflowTelemetry.recent || [],
    workflowFailed: workflowTelemetry.failedQueue || [],
    failedAutomationAlerts: workflowFailSnap,
    recentDispatches: dispatchSnap.slice(0, 15),
    slaBreaches: slaSnap.slice(0, 15),
    executive: liveExecutive(requests, waStats),
    insights: {
      highDemandProvinces,
      underServicedProvinces: [],
      highPerformingAgents: ranked
        .filter((a) => a.tier === 'Platinum' || a.tier === 'Gold')
        .slice(0, 5),
    },
    agentTierCounts: ranked.reduce((acc, a) => {
      acc[a.tier] = (acc[a.tier] || 0) + 1
      return acc
    }, {}),
  }
}

async function loadTelemetrySnaps(db) {
  try {
    const [d, s, w] = await Promise.all([
      db.collection('dispatchEvents').limit(30).get(),
      db.collection('slaBreaches').limit(30).get(),
      db.collection('workflowFailures').limit(20).get(),
    ])
    const byCreated = (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    return {
      dispatchSnap: d.docs.map((doc) => ({ id: doc.id, ...doc.data() })).sort(byCreated),
      slaSnap: s.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => new Date(b.detectedAt || 0) - new Date(a.detectedAt || 0)),
      workflowFailSnap: w.docs.map((doc) => ({ id: doc.id, ...doc.data() })).sort(byCreated),
    }
  } catch {
    return { dispatchSnap: [], slaSnap: [], workflowFailSnap: [] }
  }
}

async function buildFreshPayload() {
  const storage = getStorage()
  const db = getFirestore()

  const [requests, agents, waStats, workflowTelemetry, telemetry] = await Promise.all([
    settled(storage.getAttendanceRequests({ limit: 500 }), []),
    settled(
      db
        .collection('agents')
        .limit(300)
        .get()
        .then((snap) =>
          snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
            latitude: d.data().latitude,
            longitude: d.data().longitude,
          }))
        ),
      []
    ),
    settled(whatsappService.getWhatsAppStats(30), {
      sent: 0,
      failed: 0,
      pending: 0,
      latest: [],
    }),
    settled(workflowAutomationService.getWorkflowTelemetry({ limit: 40 }), {
      recent: [],
      failedQueue: [],
    }),
    loadTelemetrySnaps(db),
  ])

  return buildCommandCenterPayload({
    requests: Array.isArray(requests) ? requests : [],
    agents: Array.isArray(agents) ? agents : [],
    waStats: waStats || {},
    workflowTelemetry: workflowTelemetry || {},
    dispatchSnap: telemetry.dispatchSnap,
    slaSnap: telemetry.slaSnap,
    workflowFailSnap: telemetry.workflowFailSnap,
  })
}

async function getCommandCenterPayload() {
  const { logHotPath } = require('./hotPathLog')
  if (cacheEntry && Date.now() - cacheAt < CACHE_TTL_MS) {
    logHotPath({ endpoint: 'command-center', cache: 'hit', role: 'admin' })
    return cacheEntry
  }
  if (inflight) return inflight
  const started = Date.now()
  inflight = buildFreshPayload()
    .then((payload) => {
      cacheEntry = payload
      cacheAt = Date.now()
      logHotPath({
        endpoint: 'command-center',
        cache: 'miss',
        durationMs: Date.now() - started,
        role: 'admin',
      })
      return payload
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}

function resetCommandCenterCacheForTests() {
  cacheEntry = null
  cacheAt = 0
  inflight = null
}

module.exports = {
  getCommandCenterPayload,
  buildCommandCenterPayload,
  rankAgentsLight,
  CACHE_TTL_MS,
  resetCommandCenterCacheForTests,
}
