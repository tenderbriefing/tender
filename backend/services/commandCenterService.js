/**
 * Operations command center — aggregated live ops payload for admin UI.
 */
const { getFirestore } = require('../config/firebaseAdmin')
const { getStorage } = require('./storageAdapter')
const liveDispatchService = require('./liveDispatchService')
const executiveAnalyticsService = require('./executiveAnalyticsService')
const procurementInsightsService = require('./procurementInsightsService')
const agentPerformanceService = require('./agentPerformanceService')
const workflowAutomationService = require('./workflowAutomationService')
const whatsappService = require('./whatsappService')
const aiOpsExecutive = require('./aiOpsExecutiveService')

function parseDate(value) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

async function getCommandCenterPayload() {
  const storage = getStorage()
  const db = getFirestore()

  const [
    requests,
    agents,
    waStats,
    workflowTelemetry,
    executive,
    insights,
    agentRanks,
  ] = await Promise.all([
    storage.getAttendanceRequests(),
    db.collection('agents').limit(300).get().then((s) =>
      s.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        latitude: d.data().latitude,
        longitude: d.data().longitude,
      }))
    ),
    whatsappService.getWhatsAppStats(30),
    workflowAutomationService.getWorkflowTelemetry({ limit: 40 }),
    executiveAnalyticsService.getLatestExecutiveMetrics(),
    procurementInsightsService.generateProcurementInsights(),
    agentPerformanceService.rankAllAgents(),
  ])

  const pendingQueue = requests
    .filter((r) => r.status === 'pending' && r.paymentStatus === 'paid')
    .sort((a, b) => new Date(a.paidAt || a.createdAt) - new Date(b.paidAt || b.createdAt))
    .slice(0, 25)

  const dispatchBoard = []
  for (const req of pendingQueue.slice(0, 8)) {
    const matches = await liveDispatchService.findBestAgentsForRequest(req, { limit: 5 })
    dispatchBoard.push({
      requestId: req.id,
      tenderNumber: req.tenderNumber,
      province: req.province,
      paidAt: req.paidAt,
      notifiedCount: (req.notifiedAgents || []).length,
      topAgents: matches,
    })
  }

  const slaHeatmap = {}
  const now = Date.now()
  for (const r of requests.filter((r) => r.status === 'pending' && r.paymentStatus === 'paid')) {
    const paidAt = parseDate(r.paidAt)
    if (!paidAt) continue
    const mins = (now - paidAt.getTime()) / 60000
    const bucket =
      mins >= 60 ? 'critical' : mins >= 30 ? 'high' : mins >= 15 ? 'medium' : 'normal'
    const p = r.province || 'Unknown'
    if (!slaHeatmap[p]) slaHeatmap[p] = { normal: 0, medium: 0, high: 0, critical: 0 }
    slaHeatmap[p][bucket] += 1
  }

  let dispatchSnap = []
  let slaSnap = []
  let workflowFailSnap = []
  try {
    const [d, s, w] = await Promise.all([
      db.collection('dispatchEvents').limit(30).get(),
      db.collection('slaBreaches').limit(30).get(),
      db.collection('workflowFailures').limit(20).get(),
    ])
    dispatchSnap = d.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    slaSnap = s.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => new Date(b.detectedAt || 0) - new Date(a.detectedAt || 0))
    workflowFailSnap = w.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
  } catch {
    /* collections may be empty */
  }

  const paymentPipeline = {
    pending: requests.filter((r) => r.paymentStatus === 'pending').length,
    paid: requests.filter((r) => r.paymentStatus === 'paid').length,
    failed: requests.filter((r) => r.paymentStatus === 'failed').length,
    cancelled: requests.filter((r) => r.paymentStatus === 'cancelled').length,
  }

  const activeAgentsMap = agents
    .filter((a) => a.latitude && a.longitude)
    .map((a) => ({
      id: a.id,
      name: a.displayName || a.name,
      province: a.province,
      lat: a.latitude,
      lng: a.longitude,
      availability: a.availability,
      tier: agentRanks.find((r) => r.agentId === a.id)?.tier,
    }))

  const whatsappStream = (waStats.latest || [])
    .filter((n) => n.channel === 'whatsapp' || n.status)
    .slice(0, 20)
    .map((n) => ({
      id: n.id,
      status: n.status,
      type: n.type,
      createdAt: n.createdAt,
      recipientRole: n.recipientRole,
    }))

  let aiOps = null
  try {
    aiOps = await aiOpsExecutive.getAiOpsExtension()
  } catch {
    aiOps = null
  }

  return {
    generatedAt: new Date().toISOString(),
    aiOps,
    dispatchBoard,
    pendingQueue: pendingQueue.map((r) => ({
      id: r.id,
      tenderNumber: r.tenderNumber,
      province: r.province,
      smeCompany: r.smeCompany,
      paidAt: r.paidAt,
      notifiedAgents: (r.notifiedAgents || []).length,
      minutesWaiting: r.paidAt
        ? Math.round((now - parseDate(r.paidAt).getTime()) / 60000)
        : null,
    })),
    activeAgentsMap,
    slaHeatmap,
    whatsappStream,
    whatsappSummary: {
      configured: whatsappService.isConfigured(),
      sent: waStats.sent,
      failed: waStats.failed,
      pending: waStats.pending,
    },
    paymentPipeline,
    workflowTimeline: workflowTelemetry.recent || [],
    workflowFailed: workflowTelemetry.failedQueue || [],
    failedAutomationAlerts: workflowFailSnap,
    recentDispatches: dispatchSnap.slice(0, 15),
    slaBreaches: slaSnap.slice(0, 15),
    executive: executive.live,
    insights: {
      highDemandProvinces: insights.highDemandProvinces?.slice(0, 5),
      underServicedProvinces: insights.underServicedProvinces?.slice(0, 5),
      highPerformingAgents: insights.highPerformingAgents?.slice(0, 5),
    },
    agentTierCounts: agentRanks.reduce((acc, a) => {
      acc[a.tier] = (acc[a.tier] || 0) + 1
      return acc
    }, {}),
  }
}

module.exports = {
  getCommandCenterPayload,
}
