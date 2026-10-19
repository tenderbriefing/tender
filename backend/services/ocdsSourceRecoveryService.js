/**
 * Phase 19 — Durable recovery for SOURCE_UNAVAILABLE days.
 * Never promotes HTTP 500 / unavailable to SUCCESS.
 * Website channel is separate and never labeled as OCDS.
 */
const {
  DAY_STATUS,
  SOURCE_TYPE,
  ATTEMPT_RESULT,
  EXCEPTION_CATEGORY,
  emptyDayRecord,
  emptyRecoveryAttempt,
  classifyHttpFailure,
  nextRetryAtIso,
  isCertifiedSuccess,
} = require('../domain/ocdsDayReconciliation')
const { getDayRecord, saveDayRecord } = require('./ocdsDayStore')
const { replayDay } = require('./ocdsDayReplayService')
const { tryRecoverDay } = require('./ocdsBulkSourceService')
const { probeWebsiteForDay } = require('./etendersWebsiteSourceService')
const { raiseException } = require('./parityExceptionService')
const { fetchReleasesInRange } = require('./incrementalSyncService')
const auditLogService = require('./auditLogService')

function splitDayWindows(date) {
  // Four contiguous 6-hour UTC windows within the calendar day
  const base = String(date).slice(0, 10)
  return [
    { from: `${base}T00:00:00.000Z`, to: `${base}T05:59:59.999Z`, label: 'h0-6' },
    { from: `${base}T06:00:00.000Z`, to: `${base}T11:59:59.999Z`, label: 'h6-12' },
    { from: `${base}T12:00:00.000Z`, to: `${base}T17:59:59.999Z`, label: 'h12-18' },
    { from: `${base}T18:00:00.000Z`, to: `${base}T23:59:59.999Z`, label: 'h18-24' },
  ]
}

function appendAttempt(record, attempt) {
  const history = Array.isArray(record.attemptHistory) ? [...record.attemptHistory] : []
  history.push(attempt)
  record.attemptHistory = history.slice(-100)
  record.recoveryAttemptCount = (Number(record.recoveryAttemptCount) || 0) + 1
  record.lastRecoveryAt = attempt.attemptedAt
  return record
}

/**
 * Attempt OCDS recovery with full-day replay, then smaller windows, then bulk, then website probe.
 */
async function recoverUnavailableDay(date, opts = {}) {
  const force = opts.force === true
  let record = (await getDayRecord(date)) || emptyDayRecord(date)

  if (isCertifiedSuccess(record) && !force) {
    return { date, skipped: true, reason: 'already_certified', record }
  }

  if (
    record.status !== DAY_STATUS.SOURCE_UNAVAILABLE &&
    record.status !== DAY_STATUS.FAILED &&
    record.status !== DAY_STATUS.PARTIAL &&
    record.status !== DAY_STATUS.PENDING &&
    !force
  ) {
    return { date, skipped: true, reason: 'not_unavailable', record }
  }

  if (!force && record.nextRetryAt && new Date(record.nextRetryAt).getTime() > Date.now()) {
    return { date, skipped: true, reason: 'retry_not_due', record, nextRetryAt: record.nextRetryAt }
  }

  const attempts = []
  const retryCount = (Number(record.attemptCount) || 0) + 1

  // 1) Full-day OCDS replay
  const replay = await replayDay(date, {
    force: true,
    skipDocuments: opts.skipDocuments !== false,
    allowBulkFallback: false,
  })
  record = replay.record || (await getDayRecord(date)) || record
  const fullAttempt = emptyRecoveryAttempt({
    date,
    source: SOURCE_TYPE.OCDS_RELEASE_API,
    sourceType: SOURCE_TYPE.OCDS_RELEASE_API,
    endpoint: 'OCDSReleases?dateFrom/dateTo=day',
    attemptedAt: new Date().toISOString(),
    httpStatus: record.httpStatus,
    recordCount: record.sourceCount || 0,
    result:
      record.status === DAY_STATUS.SUCCESS
        ? record.sourceCount === 0
          ? ATTEMPT_RESULT.ZERO_RECORD_SUCCESS
          : ATTEMPT_RESULT.SUCCESS
        : record.status === DAY_STATUS.SOURCE_UNAVAILABLE
          ? ATTEMPT_RESULT.SOURCE_UNAVAILABLE
          : record.status === DAY_STATUS.PARTIAL
            ? ATTEMPT_RESULT.PARTIAL
            : ATTEMPT_RESULT.FAILED,
    errorClass: record.error || null,
    retryCount,
  })
  attempts.push(fullAttempt)
  record = appendAttempt(record, fullAttempt)

  if (record.status === DAY_STATUS.SUCCESS) {
    await saveDayRecord(record)
    return { date, recovered: true, via: 'ocds_release_api', record, attempts }
  }

  // 2) Smaller query windows (only when full day unavailable)
  if (record.status === DAY_STATUS.SOURCE_UNAVAILABLE || force) {
    let windowReleases = []
    let anyWindowOk = false
    let anyWindowUnavailable = false
    for (const win of splitDayWindows(date)) {
      try {
        const out = await fetchReleasesInRange(win.from, win.to, opts.maxPages || 5)
        const releases = out?.releases || (Array.isArray(out) ? out : [])
        anyWindowOk = true
        windowReleases = windowReleases.concat(releases)
        attempts.push(
          emptyRecoveryAttempt({
            date,
            source: SOURCE_TYPE.OCDS_RELEASE_API,
            endpoint: `OCDSReleases window ${win.label}`,
            attemptedAt: new Date().toISOString(),
            httpStatus: 200,
            recordCount: releases.length,
            result:
              releases.length === 0
                ? ATTEMPT_RESULT.ZERO_RECORD_SUCCESS
                : ATTEMPT_RESULT.SUCCESS,
            retryCount,
            windowFrom: win.from,
            windowTo: win.to,
          })
        )
      } catch (err) {
        const classified = classifyHttpFailure(err)
        anyWindowUnavailable = anyWindowUnavailable || classified.unavailable
        attempts.push(
          emptyRecoveryAttempt({
            date,
            source: SOURCE_TYPE.OCDS_RELEASE_API,
            endpoint: `OCDSReleases window ${win.label}`,
            attemptedAt: new Date().toISOString(),
            httpStatus: classified.httpStatus,
            recordCount: 0,
            result: ATTEMPT_RESULT.SOURCE_UNAVAILABLE,
            errorClass: classified.message,
            retryCount,
            windowFrom: win.from,
            windowTo: win.to,
          })
        )
      }
    }

    for (const a of attempts.slice(-4)) {
      record = appendAttempt(record, a)
    }

    if (anyWindowOk && windowReleases.length > 0 && !anyWindowUnavailable) {
      // Persist via replay persist path
      const { persistDayReleases } = require('./ocdsDayReplayService')
      const persisted = await persistDayReleases(windowReleases, {
        skipDocuments: opts.skipDocuments !== false,
      })
      record.status = DAY_STATUS.SUCCESS
      record.sourceType = SOURCE_TYPE.OCDS_RELEASE_API
      record.sourceCount = windowReleases.length
      record.persistedCount = persisted.persistedCount
      record.matchedCount = persisted.matchedCount
      record.missingLocallyCount = persisted.missingLocallyCount
      record.certified = persisted.missingLocallyCount === 0
      record.lastSuccessAt = new Date().toISOString()
      record.httpStatus = 200
      record.error = null
      record.nextRetryAt = null
      await saveDayRecord(record)
      return { date, recovered: true, via: 'ocds_small_windows', record, attempts }
    }
  }

  // 3) Bulk transparency (optional)
  if (opts.allowBulkFallback !== false) {
    try {
      const bulk = await tryRecoverDay(date)
      const bulkAttempt = emptyRecoveryAttempt({
        date,
        source: SOURCE_TYPE.OCDS_BULK_TRANSPARENCY,
        sourceType: SOURCE_TYPE.OCDS_BULK_TRANSPARENCY,
        endpoint: bulk?.sourceUrl || 'bulk',
        attemptedAt: new Date().toISOString(),
        httpStatus: bulk?.httpStatus ?? null,
        recordCount: bulk?.releases?.length || 0,
        result: bulk?.ok
          ? bulk.releases?.length
            ? ATTEMPT_RESULT.SUCCESS
            : ATTEMPT_RESULT.ZERO_RECORD_SUCCESS
          : ATTEMPT_RESULT.SOURCE_UNAVAILABLE,
        errorClass: bulk?.error || null,
        retryCount,
      })
      attempts.push(bulkAttempt)
      record = appendAttempt(record, bulkAttempt)

      if (bulk?.ok && Array.isArray(bulk.releases) && bulk.releases.length > 0) {
        const replayBulk = await replayDay(date, {
          force: true,
          skipDocuments: opts.skipDocuments !== false,
          allowBulkFallback: true,
        })
        record = replayBulk.record || record
        if (record.status === DAY_STATUS.SUCCESS) {
          await saveDayRecord(record)
          return { date, recovered: true, via: 'ocds_bulk', record, attempts }
        }
      }
    } catch (err) {
      attempts.push(
        emptyRecoveryAttempt({
          date,
          source: SOURCE_TYPE.OCDS_BULK_TRANSPARENCY,
          result: ATTEMPT_RESULT.SOURCE_UNAVAILABLE,
          errorClass: err instanceof Error ? err.message : String(err),
          retryCount,
        })
      )
    }
  }

  // 4) Website probe (separate channel — never marks OCDS SUCCESS)
  const website = await probeWebsiteForDay(date, { fetchImpl: opts.fetchImpl })
  for (const a of website.attempts || []) {
    record = appendAttempt(record, a)
    attempts.push(a)
  }
  record.websiteStatus = website.websiteStatus
  record.websiteDiscoverableCount = website.websiteDiscoverableCount
  record.websiteLastCheckedAt = new Date().toISOString()
  record.websiteHttpStatus = website.httpStatus
  record.websiteError = website.error || null

  // Keep OCDS day unavailable; schedule retry
  record.status = DAY_STATUS.SOURCE_UNAVAILABLE
  record.certified = false
  record.attemptCount = retryCount
  record.lastAttemptAt = new Date().toISOString()
  record.nextRetryAt = nextRetryAtIso(retryCount)
  await saveDayRecord(record)

  await raiseException({
    category: EXCEPTION_CATEGORY.SOURCE_UNAVAILABLE,
    date,
    detail: `Recovery exhausted; nextRetryAt=${record.nextRetryAt}`,
    payload: { attempts: attempts.length, websiteStatus: record.websiteStatus },
  })

  await auditLogService.logEvent({
    type: 'ocds_source_recovery',
    date,
    recovered: false,
    attemptCount: attempts.length,
  })

  return {
    date,
    recovered: false,
    via: null,
    record,
    attempts,
    website,
  }
}

async function recoverDueDays({ lookbackDays = 30, maxDays = 5, force = false } = {}) {
  const { lookbackRange, eachDateInclusive } = require('../domain/ocdsDayReconciliation')
  const range = lookbackRange(lookbackDays)
  const days = eachDateInclusive(range.dateFrom, range.dateTo)
  const results = []
  let processed = 0
  for (const day of days.reverse()) {
    if (processed >= maxDays) break
    const existing = await getDayRecord(day)
    if (!existing || existing.status !== DAY_STATUS.SOURCE_UNAVAILABLE) continue
    if (!force && existing.nextRetryAt && new Date(existing.nextRetryAt).getTime() > Date.now()) {
      continue
    }
    const out = await recoverUnavailableDay(day, { force })
    results.push(out)
    processed += 1
  }
  return { range, processed, results }
}

module.exports = {
  splitDayWindows,
  recoverUnavailableDay,
  recoverDueDays,
  appendAttempt,
}
