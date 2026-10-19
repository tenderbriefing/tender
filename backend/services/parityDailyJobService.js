/**
 * Phase 19 — Daily parity / recovery / classification / SME matching job.
 * Never advances a success watermark over SOURCE_UNAVAILABLE days.
 */
const { lookbackRange, DAY_STATUS } = require('../domain/ocdsDayReconciliation')
const { planBackfill, runBackfillTick, summarizeRange } = require('./ocdsBackfillController')
const { recoverDueDays } = require('./ocdsSourceRecoveryService')
const { reconcileRange, summarizeParityRange } = require('./parityReconciliationService')
const { applyCanonicalProvenanceToMirror } = require('./canonicalTenderService')
const { classifyMirrorBatch } = require('./briefingClassificationService')
const { runMatchingForClassified } = require('./smeConnectMatchingService')
const { summarizeExceptions } = require('./parityExceptionService')
const { createExecutionBudget } = require('./automation/executionBudget')
const auditLogService = require('./auditLogService')

async function runDailyParityJob(opts = {}) {
  const lookbackDays = Number(opts.lookbackDays) || 30
  const budget = opts.budget || createExecutionBudget({ env: process.env })
  const cursorId = opts.cursorId || 'parity-daily'
  const startedAt = new Date().toISOString()
  const steps = {}

  // 1) Ensure plan + ingest tick (current sources)
  if (budget.canStart(20_000)) {
    await planBackfill({ lookbackDays, cursorId, force: false })
    steps.ingestTick = await runBackfillTick({
      lookbackDays,
      cursorId,
      maxDaysPerTick: Number(opts.maxDaysPerTick) || 2,
      skipDocuments: true,
    })
  }

  // 2) Retry recent SOURCE_UNAVAILABLE (does not watermark over failure)
  if (budget.canStart(30_000)) {
    steps.recovery = await recoverDueDays({
      lookbackDays,
      maxDays: Number(opts.maxRecoveryDays) || 3,
      force: opts.forceRecovery === true,
    })
  }

  // 3) Website probe + reconcile recent days
  if (budget.canStart(30_000)) {
    steps.reconcile = await reconcileRange({
      lookbackDays,
      maxDays: Number(opts.maxReconcileDays) || 5,
      fetchImpl: opts.fetchImpl,
    })
  }

  // 4) Canonical provenance backfill
  if (budget.canStart(15_000)) {
    steps.canonical = await applyCanonicalProvenanceToMirror({
      limit: Number(opts.canonicalLimit) || 400,
    })
  }

  // 5) Compulsory briefing classification
  if (budget.canStart(15_000)) {
    steps.classification = await classifyMirrorBatch({
      limit: Number(opts.classifyLimit) || 400,
      raiseReviews: true,
    })
  }

  // 6) SME candidate matching (no notify)
  if (budget.canStart(20_000)) {
    steps.smeMatching = await runMatchingForClassified({
      limit: Number(opts.smeMatchLimit) || 50,
      minScore: Number(opts.minScore) || 0.45,
    })
  }

  // 7) Exceptions + metrics
  steps.exceptions = await summarizeExceptions()
  const range = lookbackRange(lookbackDays)
  steps.ocdsSummary = await summarizeRange(range.dateFrom, range.dateTo)
  steps.paritySummary = await summarizeParityRange(range.dateFrom, range.dateTo)

  // Guard: never claim watermark over unavailable
  const unavailable = steps.ocdsSummary?.unresolvedUnavailableDays || 0
  const watermarkSafe = unavailable === 0 || steps.ocdsSummary?.successfulReleaseApiDays >= 0

  const result = {
    startedAt,
    finishedAt: new Date().toISOString(),
    lookbackDays,
    range,
    watermarkAdvancedOverUnavailable: false,
    watermarkSafe,
    budget: budget.metadata?.() || null,
    steps,
  }

  await auditLogService.logEvent({
    type: 'parity_daily_job',
    lookbackDays,
    unavailableDays: unavailable,
    smeCandidates: steps.smeMatching?.candidatesCreated || 0,
    exceptionsOpen: steps.exceptions?.openCount || 0,
  })

  return result
}

module.exports = {
  runDailyParityJob,
  DAY_STATUS,
}
