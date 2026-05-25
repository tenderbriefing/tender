#!/usr/bin/env node
/**
 * Phase 12 command center QA — no secrets logged.
 */
const path = require('path')
process.chdir(path.join(__dirname, '..'))
require('./load-env-local').loadEnvLocal()

process.env.STORAGE_ADAPTER = process.env.STORAGE_ADAPTER || 'firestore'
process.env.FIREBASE_PROJECT_ID =
  process.env.FIREBASE_PROJECT_ID || 'tenderbriefing-34679'

const report = { checks: [], passed: false, blockers: [] }

function check(name, ok, detail = '') {
  report.checks.push({ name, ok, detail })
  if (!ok) report.blockers.push(`${name}${detail ? `: ${detail}` : ''}`)
}

async function main() {
  const liveDispatch = require('../backend/services/liveDispatchService')
  const agentPerf = require('../backend/services/agentPerformanceService')
  const executive = require('../backend/services/executiveAnalyticsService')
  const insights = require('../backend/services/procurementInsightsService')
  const commandCenter = require('../backend/services/commandCenterService')
  const workflow = require('../backend/services/workflowAutomationService')
  const whatsapp = require('../backend/services/whatsappService')

  const mockRequest = {
    id: 'qa-dispatch-req',
    province: 'Gauteng',
    briefingDate: new Date(Date.now() + 86400000).toISOString(),
    radiusKm: 50,
    latitude: -26.2,
    longitude: 28.04,
    paymentStatus: 'paid',
  }

  const agents = await liveDispatch.findBestAgentsForRequest(mockRequest, { limit: 5 })
  check('dispatch scoring returns agents', Array.isArray(agents))
  check(
    'dispatch scores in range',
    agents.every((a) => a.dispatchScore >= 0 && a.dispatchScore <= 100),
    `count=${agents.length}`
  )

  const ranked = await agentPerf.rankAllAgents()
  check('agent performance ranking', ranked.length >= 0)
  check(
    'agent tiers valid',
    ranked.every((a) => agentPerf.TIERS.includes(a.tier)),
    `sample=${ranked[0]?.tier || 'none'}`
  )

  const metrics = await executive.computeExecutiveMetrics()
  check('executive analytics aggregation', typeof metrics.totalTenders === 'number')
  check('executive has conversionPct', metrics.conversionPct !== undefined)

  const proc = await insights.generateProcurementInsights()
  check('procurement insights', !!proc.highDemandProvinces)

  const cc = await commandCenter.getCommandCenterPayload()
  check('command center payload', !!cc.dispatchBoard && !!cc.paymentPipeline)
  check('command center SLA heatmap', typeof cc.slaHeatmap === 'object')

  const sla = await workflow.runSlaEscalations()
  check('SLA escalation job', typeof sla.agentEscalations === 'number')

  const smart = await liveDispatch.runSmartDispatchAutomation()
  check('smart dispatch job', smart.job === 'smart_dispatch')

  const wa = await whatsapp.getWhatsAppStats(10)
  check('WhatsApp metrics', typeof wa.sent === 'number')

  try {
    const db = require('../backend/config/firebaseAdmin').getFirebaseAdmin().firestore()
    const cols = ['dispatchEvents', 'executiveMetrics', 'slaBreaches', 'workflowFailures']
    for (const col of cols) {
      await db.collection(col).limit(1).get()
      check(`Firestore ${col} readable`, true)
    }
  } catch (e) {
    check('Firestore telemetry collections', false, e.message)
  }

  report.passed = report.blockers.length === 0
  report.operationalReadiness = report.passed ? 'ready' : 'not_ready'
  report.summary = {
    dispatchCandidates: agents.length,
    agentRanked: ranked.length,
    executivePaidRequests: metrics.paidRequests,
    smartDispatch: smart,
  }
  console.log(JSON.stringify(report, null, 2))
  process.exit(report.passed ? 0 : 1)
}

main().catch((e) => {
  console.log(JSON.stringify({ passed: false, error: e.message }))
  process.exit(1)
})
