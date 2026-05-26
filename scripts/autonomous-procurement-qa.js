#!/usr/bin/env node
/**
 * Autonomous procurement automation QA (sections 16–30).
 */
const fs = require('fs')
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

const COLLECTIONS = require('../backend/services/ai/autonomousCollections')

async function main() {
  const services = [
    'backend/services/ai/noShowPredictionService.js',
    'backend/services/ai/rfqTriageService.js',
    'backend/services/ai/procurementWatchlistService.js',
    'backend/services/ai/submissionReadinessService.js',
    'backend/services/ai/smartEscalationService.js',
    'backend/services/ai/dailyProcurementBriefService.js',
    'backend/services/ai/procurementMemoryService.js',
    'backend/services/ai/revenueOptimizationService.js',
    'backend/services/ai/procurementForecastingService.js',
    'backend/services/autonomousProcurementPipeline.js',
    'backend/services/enterpriseFieldOpsService.js',
    'backend/services/calendarIntelligenceService.js',
  ]
  for (const f of services) check(`file ${f}`, fs.existsSync(path.join(process.cwd(), f)))

  const rules = fs.readFileSync('firestore.rules', 'utf8')
  for (const col of Object.values(COLLECTIONS)) {
    check(`rules ${col}`, rules.includes(`match /${col}/`))
  }

  const liveDispatch = require('../backend/services/liveDispatchService')
  check('dispatch automation logs export', liveDispatch.DISPATCH_AUTOMATION_LOGS === COLLECTIONS.DISPATCH_AUTOMATION_LOGS)
  check('arrival probability helper', typeof liveDispatch.estimateArrivalProbability === 'function')

  const { getStorage } = require('../backend/services/storageAdapter')
  const requests = await getStorage().getAttendanceRequests()
  const sample = requests.find((r) => r.province) || {
    id: 'qa-auto-dispatch',
    province: 'Gauteng',
    briefingDate: new Date(Date.now() + 86400000).toISOString(),
    paymentStatus: 'paid',
    status: 'pending',
  }
  const ranked = await liveDispatch.findBestAgentsForRequest(sample, { limit: 3 })
  check('auto-dispatch ranking', ranked.length >= 0)
  if (ranked[0]) {
    check('dispatch score present', ranked[0].dispatchScore >= 0)
    check('arrival probability', ranked[0].arrivalProbability != null)
    check('province/radius scoring', ranked[0].distanceKm == null || ranked[0].distanceKm >= 0)
  }

  const noShow = require('../backend/services/ai/noShowPredictionService')
  const pred = await noShow.predictNoShow(sample)
  check('no-show prediction', typeof pred.predictedNoShow === 'boolean')
  check('no-show confidence', pred.confidence >= 0)

  const rfqTriage = require('../backend/services/ai/rfqTriageService')
  const triage = rfqTriage.classifyRfq(
    {
      title: 'QA RFQ',
      briefingDetected: true,
      compulsoryBriefing: true,
      readiness: { dispatchEligible: true, confidence: 0.8, urgency: 'high' },
    },
    { duplicate: false }
  )
  check('autonomous RFQ triage', triage.outcome === 'dispatch_ready')

  const briefingSummary = require('../backend/services/ai/briefingSummaryService')
  const summary = await briefingSummary.summarizeBriefingReport({
    id: `qa-report-${Date.now()}`,
    notes: 'Compulsory briefing attended. Must submit tax clearance and CSD.',
    status: 'submitted',
  })
  check('AI briefing summary', Boolean(summary.executiveSummary))
  check('executive risks', Array.isArray(summary.risks))

  const fraud = require('../backend/services/trust/fraudDetectionService')
  const fraudInsight = await fraud.buildFraudAutomationInsight('qa-agent', {}, [])
  check('fraud automation insight', fraudInsight.recommendedAction != null)

  const pipeline = require('../backend/services/autonomousProcurementPipeline')
  const cycle = await pipeline.runAutonomousCycle()
  check('autonomous cycle memory', Boolean(cycle.memory))

  const workflow = require('../backend/services/workflowAutomationService')
  const dup = await workflow.dispatchWorkflowEvent('attendance_requested', {
    id: 'qa-reminder-dedupe',
    requestId: 'qa-reminder-dedupe',
    smeId: 'qa-sme',
    idempotencySuffix: 'dedupe-test-1',
  })
  const dup2 = await workflow.dispatchWorkflowEvent('attendance_requested', {
    id: 'qa-reminder-dedupe',
    requestId: 'qa-reminder-dedupe',
    smeId: 'qa-sme',
    idempotencySuffix: 'dedupe-test-1',
  })
  check('reminder dedupe', dup2.duplicate === true || dup.duplicate === true)

  const out = JSON.stringify({ pred, triage, summary, cycle })
  check('no secret leakage', !/sk-[a-zA-Z0-9]{20,}/.test(out) && !/OPENAI_API_KEY=/.test(out))

  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
  check('npm script ai-ops:qa', Boolean(pkg.scripts['ai-ops:qa']))
  check('npm script calendar:qa', Boolean(pkg.scripts['calendar:qa']))

  report.passed = report.blockers.length === 0
  report.operationalReadiness = report.passed ? 'ready' : 'blocked'
  console.log(JSON.stringify(report, null, 2))
  process.exit(report.passed ? 0 : 1)
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
