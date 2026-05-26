/**
 * Autonomous procurement pipeline — email → triage → compliance → dispatch → monitor → summarize.
 */
const emailIngestion = require('./procurement/emailIngestionService')
const rfqTriage = require('./ai/rfqTriageService')
const submissionReadiness = require('./ai/submissionReadinessService')
const watchlist = require('./ai/procurementWatchlistService')
const noShow = require('./ai/noShowPredictionService')
const briefingSummary = require('./ai/briefingSummaryService')
const procurementMemory = require('./ai/procurementMemoryService')
const revenueOptimization = require('./ai/revenueOptimizationService')
const { getStorage } = require('./storageAdapter')

async function processIngestedEmail(emailId, options = {}) {
  const doc = await emailIngestion.getById(emailId)
  if (!doc) throw new Error('Email not found')

  const triage = await rfqTriage.triageIngestedEmail(doc)
  const steps = [{ step: 'triage', outcome: triage.outcome }]

  let tender = null
  if (options.autoConvert && triage.outcome === 'dispatch_ready' && doc.forwardedByUid) {
    await emailIngestion.updateStatus(emailId, 'approved', { approvedBy: 'automation' })
    const converted = await emailIngestion.convertToPrivateOpportunity(emailId, {
      ownerUid: doc.forwardedByUid,
      approvedBy: 'automation',
    })
    tender = converted.tender
    steps.push({ step: 'convert', tenderId: tender.id })

    const readiness = await submissionReadiness.evaluateSubmissionReadiness(
      doc.forwardedByUid,
      tender.id
    )
    steps.push({ step: 'compliance', readinessScore: readiness.readinessScore })

    try {
      await watchlist.buildWatchlistForSme(doc.forwardedByUid)
      steps.push({ step: 'watchlist_updated' })
    } catch {
      /* optional */
    }
  }

  return { emailId, triage, tender, steps, completedAt: new Date().toISOString() }
}

async function monitorActiveAttendance() {
  const storage = getStorage()
  const requests = await storage.getAttendanceRequests()
  let predictions = 0
  for (const request of requests) {
    if (!['pending', 'assigned', 'accepted'].includes(request.status)) continue
    await noShow.predictNoShow(request)
    predictions += 1
    if (request.paymentStatus === 'paid') {
      await revenueOptimization.logPricingOptimization(request)
    }
  }
  return { predictions }
}

async function postBriefingPipeline(report) {
  const summary = await briefingSummary.summarizeBriefingReport(report, { executive: true })
  const storage = getStorage()
  const request = report.requestId
    ? (await storage.getAttendanceRequests()).find((r) => r.id === report.requestId)
    : null
  if (request?.smeId) {
    await submissionReadiness.evaluateSubmissionReadiness(request.smeId, request.tenderId)
  }
  return { summary, requestId: report.requestId }
}

async function runAutonomousCycle(options = {}) {
  const results = {}
  results.memory = await procurementMemory.refreshProcurementMemory()
  results.noShow = await noShow.runNoShowSweep()
  results.monitoring = await monitorActiveAttendance()

  if (options.emailId) {
    results.pipeline = await processIngestedEmail(options.emailId, {
      autoConvert: options.autoConvert === true,
    })
  }

  return { job: 'autonomous_procurement_cycle', ...results }
}

module.exports = {
  processIngestedEmail,
  monitorActiveAttendance,
  postBriefingPipeline,
  runAutonomousCycle,
}
