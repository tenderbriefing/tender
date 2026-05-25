/**
 * AI Operations & National Field Network — executive payload aggregator.
 */
const { getFirestore } = require('../config/firebaseAdmin')
const { getStorage } = require('./storageAdapter')
const opportunityScoring = require('./ai/opportunityScoringService')
const procurementMatching = require('./ai/procurementMatchingService')
const pricingIntelligence = require('./ai/pricingIntelligenceService')
const dispatchOptimization = require('./ai/dispatchOptimizationService')
const liveDispatchTracking = require('./fieldOperations/liveDispatchTrackingService')
const reconciliationService = require('./finance/reconciliationService')
const commissionService = require('./finance/commissionService')
const payoutService = require('./finance/payoutService')
const fraudDetection = require('./trust/fraudDetectionService')
const performanceAudit = require('./trust/performanceAuditService')
const agentVerification = require('./trust/agentVerificationService')
const whatsappService = require('./whatsappService')

const SA_PROVINCES = [
  'Eastern Cape',
  'Free State',
  'Gauteng',
  'KwaZulu-Natal',
  'Limpopo',
  'Mpumalanga',
  'Northern Cape',
  'North West',
  'Western Cape',
]

async function getAiOpsExtension() {
  const storage = getStorage()
  const db = getFirestore()

  const [requests, agentsSnap, fraudAlerts, payouts, reconciliation, commission, waStats] =
    await Promise.all([
      storage.getAttendanceRequests(),
      db.collection('agents').limit(400).get(),
      fraudDetection.listFraudAlerts(25),
      payoutService.listPayouts(20),
      reconciliationService.reconcilePayments(),
      commissionService.getCommissionSummary(),
      whatsappService.getWhatsAppStats(40),
    ])

  const agents = agentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
  const provinceStats = {}
  for (const p of SA_PROVINCES) {
    provinceStats[p] = {
      activeBriefings: 0,
      pendingDispatch: 0,
      agents: 0,
    }
  }
  for (const a of agents) {
    const p = a.province || 'Unknown'
    if (!provinceStats[p]) provinceStats[p] = { activeBriefings: 0, pendingDispatch: 0, agents: 0 }
    provinceStats[p].agents += 1
  }
  for (const r of requests) {
    const p = r.province || 'Unknown'
    if (!provinceStats[p]) provinceStats[p] = { activeBriefings: 0, pendingDispatch: 0, agents: 0 }
    if (['accepted', 'in_progress'].includes(r.status)) provinceStats[p].activeBriefings += 1
    if (r.status === 'pending' && r.paymentStatus === 'paid') provinceStats[p].pendingDispatch += 1
  }

  const activeBriefings = await liveDispatchTracking.getActiveBriefings()
  const provinceDemand = await procurementMatching.matchProvinceDemand()
  const sectorOpportunity = await procurementMatching.matchSectorOpportunity()

  const pendingPaid = requests.filter((r) => r.status === 'pending' && r.paymentStatus === 'paid')
  const dispatchOptimizations = []
  for (const req of pendingPaid.slice(0, 5)) {
    dispatchOptimizations.push(await dispatchOptimization.optimizeDispatch(req))
  }

  const agentHeatmap = agents
    .filter((a) => a.latitude && a.longitude)
    .map((a) => ({
      agentId: a.id,
      name: a.displayName || a.name,
      province: a.province,
      lat: a.latitude,
      lng: a.longitude,
      reliabilityScore: a.reliabilityScore,
      verificationStatus: a.verificationStatus,
    }))

  const opportunityTrends = (await storage.getAllTenders())
    .filter((t) => t.briefingCompulsory)
    .slice(0, 30)
    .map((t) => opportunityScoring.scoreTenderOpportunity(t))
    .sort((a, b) => b.urgencyScore - a.urgencyScore)
    .slice(0, 8)

  const verifiedCount = agents.filter((a) => a.verificationStatus === 'verified').length
  const pendingVerification = await agentVerification.listPending(20)

  let gpsLogs = []
  try {
    const g = await db.collection('gpsAttendanceLogs').orderBy('serverTimestamp', 'desc').limit(15).get()
    gpsLogs = g.docs.map((d) => ({ id: d.id, ...d.data() }))
  } catch {
    gpsLogs = []
  }

  const dispatchFailures = requests.filter(
    (r) => r.paymentStatus === 'paid' && r.status === 'pending' && !(r.notifiedAgents || []).length
  ).length

  return {
    nationalField: {
      provinces: provinceStats,
      allProvincesTracked: SA_PROVINCES.length,
      activeBriefings: activeBriefings.length,
      liveDispatches: dispatchOptimizations.length,
      gpsAttendanceRecent: gpsLogs,
    },
    aiInsights: {
      opportunityTrends,
      provinceDemand: provinceDemand.slice(0, 9),
      sectorOpportunity: sectorOpportunity.slice(0, 8),
      pricingSample: pricingIntelligence.estimateBriefingPricing({
        distanceKm: 25,
        briefingDate: new Date(Date.now() + 86400000 * 5).toISOString(),
        provinceDemand: 60,
      }),
    },
    operationalRisk: {
      slaBreachSignal: pendingPaid.filter((r) => {
        const paid = new Date(r.paidAt || r.createdAt).getTime()
        return Date.now() - paid > 3600000
      }).length,
      dispatchFailures,
      fraudAlerts: fraudAlerts.slice(0, 10),
      openFraudCount: fraudAlerts.filter((f) => f.status === 'open').length,
    },
    dispatchCongestion: provinceDemand.map((p) => ({
      province: p.province,
      demand: p.demand,
      agents: provinceStats[p.province]?.agents || 0,
      congestion:
        (provinceStats[p.province]?.agents || 0) > 0
          ? Math.round((p.demand / provinceStats[p.province].agents) * 10) / 10
          : p.demand,
    })),
    agentHeatmap,
    finance: {
      commission,
      reconciliation,
      recentPayouts: payouts.slice(0, 10),
    },
    trust: {
      verifiedAgents: verifiedCount,
      pendingVerification: pendingVerification.length,
      performanceAuditsSample: (await performanceAudit.auditAllAgents(5)).slice(0, 5),
    },
    supportQueues: {
      pendingPaid: pendingPaid.length,
      whatsappHealth: waStats,
    },
    enterpriseAccounts: agents.filter((a) => a.enterprise).length,
    revenueTodayCents: commission.grossCents,
  }
}

async function runAiOpsSelfTest() {
  const storage = getStorage()
  const tenders = await storage.getAllTenders()
  const tender = tenders[0] || {
    id: 'qa-tender',
    title: 'QA Tender',
    briefingCompulsory: true,
    province: 'Gauteng',
    closingDate: new Date(Date.now() + 86400000 * 10).toISOString(),
  }

  const tenderSummary = require('./ai/tenderSummaryService')
  const summary = await tenderSummary.generateTenderSummary(tender)
  const scores = opportunityScoring.scoreTenderOpportunity(tender)
  const pricing = pricingIntelligence.estimateBriefingPricing({ distanceKm: 30 })
  const requests = await storage.getAttendanceRequests()
  const req = requests[0] || {
    id: 'qa-req',
    province: 'Gauteng',
    paymentStatus: 'paid',
    status: 'pending',
    paidAt: new Date().toISOString(),
  }
  const dispatch = await dispatchOptimization.optimizeDispatch(req)
  const gps = require('./fieldOperations/gpsAttendanceService')
  const gpsLog = await gps.recordGpsEvent({
    requestId: req.id,
    agentId: 'qa-agent',
    eventType: 'check_in',
    latitude: -26.2,
    longitude: 28.04,
    siteLatitude: -26.2,
    siteLongitude: 28.05,
    selfiePlaceholder: true,
  })
  const payout = await require('./finance/payoutService').createPayoutBatch('qa-agent', [])
  const fraud = await fraudDetection.scanAgentActivity('qa-agent', { requestId: req.id })
  const recon = await reconciliationService.reconcilePayments()
  const dashboard = await getAiOpsExtension()

  return {
    summary,
    scores,
    pricing,
    dispatch,
    gpsLog,
    payout,
    fraud,
    recon,
    dashboardLoaded: Boolean(dashboard.nationalField),
  }
}

module.exports = {
  getAiOpsExtension,
  runAiOpsSelfTest,
}
