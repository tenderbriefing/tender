/**
 * Phase 18 — Process a single calendar day of OCDS releases into the local mirror.
 * Idempotent. Never marks HTTP 500 as SUCCESS.
 */
const {
  DAY_STATUS,
  SOURCE_TYPE,
  DIFF_CLASS,
  emptyDayRecord,
  classifyHttpFailure,
  classifyFieldDiffs,
  nextRetryAtIso,
  isCertifiedSuccess,
} = require('../domain/ocdsDayReconciliation')
const { getDayRecord, saveDayRecord } = require('./ocdsDayStore')
const {
  fetchReleasesForDay,
  parseOcdsRelease,
  isSkippableOcdsDayError,
} = require('./incrementalSyncService')
const { processTender } = require('./tenderPipeline')
const { findDuplicateInList } = require('./deduplicationService')
const { getStorage } = require('./storageAdapter')
const { contentHash } = require('./tenderModel')
const auditLogService = require('./auditLogService')

function localKey(tender) {
  const ocid = String(tender?.ocid || '').trim()
  if (ocid) return `ocid:${ocid}`
  const num = String(tender?.tenderNumber || '').trim()
  if (num) return `tn:${num}`
  return `id:${tender?.id || ''}`
}

function sourceKey(release) {
  const ocid = String(release?.ocid || '').trim()
  if (ocid) return `ocid:${ocid}`
  const num = String(release?.tender?.id || '').trim()
  if (num) return `tn:${num}`
  return `id:${release?.id || ''}`
}

/**
 * Persist releases for one day. Returns counts + diffs.
 */
async function persistDayReleases(releases, { skipDocuments = true } = {}) {
  const storage = getStorage()
  const existing = await storage.getTenderBriefings({ limit: 8000 })
  const byKey = new Map()
  for (const t of existing) byKey.set(localKey(t), t)

  const upserts = []
  let unchanged = 0
  let parsedCount = 0
  const missing = []
  const fieldDiffSamples = []
  let fieldMismatchCount = 0
  let documentMismatchCount = 0
  let matchedCount = 0

  const unique = new Map()
  for (const release of releases || []) {
    unique.set(sourceKey(release), release)
  }

  for (const [, release] of unique) {
    try {
      const mapped = parseOcdsRelease(release)
      parsedCount += 1
      mapped.sourceType = SOURCE_TYPE.OCDS_RELEASE_API
      mapped.sourceRetrievedAt = new Date().toISOString()

      const duplicate = byKey.get(localKey(mapped)) || findDuplicateInList(existing, mapped)
      const diffs = classifyFieldDiffs(mapped, duplicate || null)
      if (!duplicate) {
        missing.push({
          class: DIFF_CLASS.MISSING_LOCAL_RECORD,
          ocid: mapped.ocid,
          tenderNumber: mapped.tenderNumber,
          title: mapped.title,
        })
      } else {
        matchedCount += 1
        if (diffs.length) {
          fieldMismatchCount += diffs.filter((d) => d.field && d.field !== 'documents').length
          if (diffs.some((d) => d.field === 'documents')) documentMismatchCount += 1
          if (fieldDiffSamples.length < 30) {
            fieldDiffSamples.push({
              ocid: mapped.ocid,
              tenderNumber: mapped.tenderNumber,
              diffs,
            })
          }
        }
      }

      if (duplicate?.ingestedAt) mapped.ingestedAt = duplicate.ingestedAt

      const sameHash =
        duplicate &&
        duplicate.contentHash &&
        duplicate.contentHash === contentHash(mapped) &&
        duplicate.rawSourceHash &&
        duplicate.rawSourceHash === mapped.rawSourceHash

      if (sameHash) {
        unchanged += 1
        continue
      }

      const processed = await processTender(mapped, duplicate, { skipDocuments })
      processed.sourceType = SOURCE_TYPE.OCDS_RELEASE_API
      processed.sourceRetrievedAt = mapped.sourceRetrievedAt
      upserts.push(processed)
      byKey.set(localKey(processed), processed)
      const memIdx = existing.findIndex((t) => t.id === processed.id)
      if (memIdx >= 0) existing[memIdx] = processed
      else existing.push(processed)
    } catch (err) {
      // Continue other releases — do not fail the whole day for one bad row
      await auditLogService.logEvent({
        type: 'ocds_day_release_failed',
        ocid: release?.ocid,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  let persistedCount = 0
  if (upserts.length) {
    const result = await storage.upsertTenders(upserts)
    persistedCount = result?.written ?? upserts.length
  }

  // After upsert, missing that were just written are no longer missing
  const missingAfter = missing.filter((m) => {
    const key = m.ocid ? `ocid:${m.ocid}` : `tn:${m.tenderNumber}`
    return !byKey.has(key)
  })

  return {
    sourceCount: unique.size,
    parsedCount,
    persistedCount,
    unchanged,
    matchedCount: matchedCount + (missing.length - missingAfter.length),
    missingLocallyCount: missingAfter.length,
    missingLocally: missingAfter.slice(0, 50),
    fieldMismatchCount,
    documentMismatchCount,
    fieldDiffSamples,
  }
}

/**
 * Replay / certify a single calendar day.
 * @param {string} date YYYY-MM-DD
 * @param {{ force?: boolean, skipDocuments?: boolean, allowBulkFallback?: boolean }} opts
 */
async function replayDay(date, opts = {}) {
  const day = String(date || '').slice(0, 10)
  const force = opts.force === true
  const started = Date.now()
  let record = (await getDayRecord(day)) || emptyDayRecord(day)

  if (!force && isCertifiedSuccess(record)) {
    return { skipped: true, reason: 'already_certified', record }
  }

  record.status = DAY_STATUS.RUNNING
  record.lastAttemptAt = new Date().toISOString()
  record.attemptCount = Number(record.attemptCount || 0) + 1
  record.error = null
  await saveDayRecord(record)

  try {
    const dayResult = await fetchReleasesForDay(day, opts.maxPages)
    const releases = dayResult.releases || []

    if (dayResult.truncated) {
      record.status = DAY_STATUS.PARTIAL
      record.truncated = true
      record.pagesFetched = dayResult.pagesFetched
      record.httpStatus = 200
      record.sourceType = SOURCE_TYPE.OCDS_RELEASE_API
      record.sourceUrl = `https://ocds-api.etenders.gov.za/api/OCDSReleases?dateFrom=${day}&dateTo=${day}`
      record.error = 'Day pagination truncated before links.next exhausted'
      record.nextRetryAt = nextRetryAtIso(record.attemptCount)
      record.durationMs = Date.now() - started
      record.attemptHistory = [
        ...(record.attemptHistory || []).slice(-9),
        {
          at: record.lastAttemptAt,
          status: DAY_STATUS.PARTIAL,
          httpStatus: 200,
          sourceCount: releases.length,
        },
      ]
      const persist = await persistDayReleases(releases, {
        skipDocuments: opts.skipDocuments !== false,
      })
      Object.assign(record, {
        sourceCount: persist.sourceCount,
        parsedCount: persist.parsedCount,
        persistedCount: persist.persistedCount,
        matchedCount: persist.matchedCount,
        missingLocallyCount: persist.missingLocallyCount,
        fieldMismatchCount: persist.fieldMismatchCount,
        documentMismatchCount: persist.documentMismatchCount,
        missingLocally: persist.missingLocally,
        fieldDiffSamples: persist.fieldDiffSamples,
        certified: false,
      })
      await saveDayRecord(record)
      return { skipped: false, record, persist }
    }

    // Legitimate HTTP 200 with zero releases = SUCCESS
    const persist = await persistDayReleases(releases, {
      skipDocuments: opts.skipDocuments !== false,
    })

    record.status = DAY_STATUS.SUCCESS
    record.certified = persist.missingLocallyCount === 0
    record.httpStatus = 200
    record.sourceType = SOURCE_TYPE.OCDS_RELEASE_API
    record.sourceUrl = `https://ocds-api.etenders.gov.za/api/OCDSReleases?dateFrom=${day}&dateTo=${day}`
    record.retrievedAt = new Date().toISOString()
    record.lastSuccessAt = record.retrievedAt
    record.nextRetryAt = null
    record.truncated = false
    record.pagesFetched = dayResult.pagesFetched
    record.sourceCount = persist.sourceCount
    record.parsedCount = persist.parsedCount
    record.persistedCount = persist.persistedCount
    record.matchedCount = persist.matchedCount
    record.missingLocallyCount = persist.missingLocallyCount
    record.fieldMismatchCount = persist.fieldMismatchCount
    record.documentMismatchCount = persist.documentMismatchCount
    record.missingLocally = persist.missingLocally
    record.fieldDiffSamples = persist.fieldDiffSamples
    record.durationMs = Date.now() - started
    record.error =
      persist.missingLocallyCount > 0
        ? `missingLocallyCount=${persist.missingLocallyCount}`
        : null
    if (persist.missingLocallyCount > 0) {
      record.status = DAY_STATUS.PARTIAL
      record.certified = false
      record.nextRetryAt = nextRetryAtIso(record.attemptCount)
    }
    record.attemptHistory = [
      ...(record.attemptHistory || []).slice(-9),
      {
        at: record.lastAttemptAt,
        status: record.status,
        httpStatus: 200,
        sourceCount: persist.sourceCount,
        missingLocallyCount: persist.missingLocallyCount,
      },
    ]

    // Emit SME Connect boundary event for newly persisted compulsory briefings
    try {
      const { emitSmeConnectBriefingIngested } = require('./smeConnectEventBoundary')
      await emitSmeConnectBriefingIngested({
        day,
        sourceCount: persist.sourceCount,
        persistedCount: persist.persistedCount,
      })
    } catch {
      /* boundary must not break replay */
    }

    await saveDayRecord(record)
    await auditLogService.logEvent({
      type: 'ocds_day_replayed',
      date: day,
      status: record.status,
      sourceCount: record.sourceCount,
      missingLocallyCount: record.missingLocallyCount,
      certified: record.certified,
    })

    return { skipped: false, record, persist }
  } catch (error) {
    const classified = classifyHttpFailure(error)

    // Optional bulk fallback for unavailable API days
    if (classified.unavailable && opts.allowBulkFallback !== false) {
      try {
        const bulk = require('./ocdsBulkSourceService')
        const bulkResult = await bulk.tryRecoverDay(day)
        if (bulkResult?.ok && Array.isArray(bulkResult.releases)) {
          const persist = await persistDayReleases(bulkResult.releases, {
            skipDocuments: true,
          })
          record.status =
            persist.missingLocallyCount === 0 ? DAY_STATUS.SUCCESS : DAY_STATUS.PARTIAL
          record.certified = persist.missingLocallyCount === 0
          record.sourceType = SOURCE_TYPE.OCDS_BULK_TRANSPARENCY
          record.sourceUrl = bulkResult.sourceUrl || null
          record.httpStatus = 200
          record.sourceCount = persist.sourceCount
          record.parsedCount = persist.parsedCount
          record.persistedCount = persist.persistedCount
          record.matchedCount = persist.matchedCount
          record.missingLocallyCount = persist.missingLocallyCount
          record.fieldMismatchCount = persist.fieldMismatchCount
          record.documentMismatchCount = persist.documentMismatchCount
          record.missingLocally = persist.missingLocally
          record.retrievedAt = new Date().toISOString()
          record.lastSuccessAt = record.retrievedAt
          record.nextRetryAt =
            persist.missingLocallyCount > 0 ? nextRetryAtIso(record.attemptCount) : null
          record.durationMs = Date.now() - started
          record.error = bulkResult.note || null
          record.attemptHistory = [
            ...(record.attemptHistory || []).slice(-9),
            {
              at: record.lastAttemptAt,
              status: record.status,
              sourceType: SOURCE_TYPE.OCDS_BULK_TRANSPARENCY,
              sourceCount: persist.sourceCount,
            },
          ]
          await saveDayRecord(record)
          return { skipped: false, record, persist, recoveredViaBulk: true }
        }
      } catch {
        /* bulk unavailable — fall through to SOURCE_UNAVAILABLE */
      }
    }

    record.status = classified.unavailable ? DAY_STATUS.SOURCE_UNAVAILABLE : DAY_STATUS.FAILED
    record.httpStatus = classified.httpStatus
    record.error = classified.message
    record.sourceType = SOURCE_TYPE.UNRESOLVED
    record.nextRetryAt = nextRetryAtIso(record.attemptCount)
    record.durationMs = Date.now() - started
    record.certified = false
    record.attemptHistory = [
      ...(record.attemptHistory || []).slice(-9),
      {
        at: record.lastAttemptAt,
        status: record.status,
        httpStatus: classified.httpStatus,
        error: classified.message.slice(0, 200),
      },
    ]
    await saveDayRecord(record)

    if (!isSkippableOcdsDayError(error) && !classified.unavailable) {
      throw error
    }

    return { skipped: false, record, sourceUnavailable: classified.unavailable }
  }
}

module.exports = {
  replayDay,
  persistDayReleases,
  localKey,
  sourceKey,
}
