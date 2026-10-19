/**
 * Phase 18 — Resumable day-level backfill controller.
 * Processes days independently within an execution budget; persists cursor.
 * Self-continues via optional callback / HTTP re-enqueue (no Cloud Tasks required).
 */
const {
  DAY_STATUS,
  eachDateInclusive,
  lookbackRange,
  isCertifiedSuccess,
} = require('../domain/ocdsDayReconciliation')
const { ensurePendingDays, getDayRecord, listDayRecords } = require('./ocdsDayStore')
const { replayDay } = require('./ocdsDayReplayService')
const { createExecutionBudget } = require('./automation/executionBudget')
const auditLogService = require('./auditLogService')

const CURSOR_COLLECTION_HINT = 'ocdsBackfillCursor'

async function loadCursor(cursorId = 'default') {
  const { getStorage } = require('./storageAdapter')
  const storage = getStorage()
  if (typeof storage.getSyncState === 'function') {
    const state = await storage.getSyncState()
    return state.ocdsBackfillCursors?.[cursorId] || null
  }
  return null
}

async function saveCursor(cursorId, cursor) {
  const { getStorage } = require('./storageAdapter')
  const storage = getStorage()
  const state = await storage.getSyncState()
  state.ocdsBackfillCursors = {
    ...(state.ocdsBackfillCursors || {}),
    [cursorId]: { ...cursor, updatedAt: new Date().toISOString() },
  }
  await storage.saveSyncState(state)
  return state.ocdsBackfillCursors[cursorId]
}

function shouldProcessDay(record, { force = false, failedOnly = false, now = new Date() } = {}) {
  if (!record) return true
  if (force) return true
  if (isCertifiedSuccess(record)) return false
  if (failedOnly) {
    return (
      record.status === DAY_STATUS.SOURCE_UNAVAILABLE ||
      record.status === DAY_STATUS.FAILED ||
      record.status === DAY_STATUS.PARTIAL ||
      record.status === DAY_STATUS.PENDING
    )
  }
  if (record.status === DAY_STATUS.RUNNING) {
    // Stale running (>20 min) can be reclaimed
    const started = record.lastAttemptAt ? new Date(record.lastAttemptAt).getTime() : 0
    return !started || now.getTime() - started > 20 * 60 * 1000
  }
  if (
    record.status === DAY_STATUS.SOURCE_UNAVAILABLE ||
    record.status === DAY_STATUS.FAILED ||
    record.status === DAY_STATUS.PARTIAL
  ) {
    if (!record.nextRetryAt) return true
    return new Date(record.nextRetryAt).getTime() <= now.getTime()
  }
  if (record.status === DAY_STATUS.PENDING) return true
  return false
}

/**
 * Plan a backfill for a date range (creates PENDING day records).
 */
async function planBackfill(opts = {}) {
  let dateFrom = opts.dateFrom
  let dateTo = opts.dateTo
  if (!dateFrom || !dateTo) {
    const range = lookbackRange(opts.lookbackDays || 30, opts.now || new Date())
    dateFrom = dateFrom || range.dateFrom
    dateTo = dateTo || range.dateTo
  }
  const days = eachDateInclusive(dateFrom, dateTo)
  const records = await ensurePendingDays(days)
  const cursor = await saveCursor(opts.cursorId || 'default', {
    dateFrom,
    dateTo,
    nextIndex: 0,
    force: opts.force === true,
    failedOnly: opts.failedOnly === true,
    status: 'planned',
    daysTotal: days.length,
    daysProcessed: 0,
  })
  return { dateFrom, dateTo, days, records, cursor }
}

/**
 * Process next N processable days within budget. Resumable.
 */
async function runBackfillTick(opts = {}) {
  const cursorId = opts.cursorId || 'default'
  const budget = opts.budget || createExecutionBudget({ env: process.env })
  const force = opts.force === true
  const failedOnly = opts.failedOnly === true
  const maxDaysPerTick = Math.max(1, Number(opts.maxDaysPerTick) || 3)

  let cursor = (await loadCursor(cursorId)) || null
  if (!cursor?.dateFrom || !cursor?.dateTo) {
    const planned = await planBackfill(opts)
    cursor = planned.cursor
  }

  const days = eachDateInclusive(cursor.dateFrom, cursor.dateTo)
  const results = []
  let processed = 0
  let nextIndex = Number(cursor.nextIndex) || 0

  while (processed < maxDaysPerTick && nextIndex < days.length && budget.canStart(15_000)) {
    const day = days[nextIndex]
    nextIndex += 1
    const existing = await getDayRecord(day)
    if (!shouldProcessDay(existing, { force, failedOnly })) {
      results.push({ day, skipped: true, reason: 'not_due', status: existing?.status })
      continue
    }

    const outcome = await replayDay(day, {
      force,
      skipDocuments: opts.skipDocuments !== false,
      allowBulkFallback: opts.allowBulkFallback !== false,
    })
    results.push({
      day,
      skipped: outcome.skipped === true,
      status: outcome.record?.status,
      sourceCount: outcome.record?.sourceCount,
      missingLocallyCount: outcome.record?.missingLocallyCount,
      recoveredViaBulk: outcome.recoveredViaBulk === true,
      sourceUnavailable: outcome.sourceUnavailable === true,
    })
    processed += 1
  }

  const done = nextIndex >= days.length
  const saved = await saveCursor(cursorId, {
    ...cursor,
    nextIndex,
    daysProcessed: (Number(cursor.daysProcessed) || 0) + processed,
    status: done ? 'completed' : 'in_progress',
    lastTickAt: new Date().toISOString(),
    lastTickResults: results,
  })

  await auditLogService.logEvent({
    type: 'ocds_backfill_tick',
    cursorId,
    processed,
    nextIndex,
    done,
    dateFrom: cursor.dateFrom,
    dateTo: cursor.dateTo,
  })

  return {
    cursor: saved,
    results,
    done,
    moreRemaining: !done,
    budget: budget.metadata(),
  }
}

/**
 * Summarize day statuses for a range (admin dashboard).
 */
async function summarizeRange(dateFrom, dateTo) {
  const days = eachDateInclusive(dateFrom, dateTo)
  const records = await listDayRecords({ dateFrom, dateTo, limit: 400 })
  const byDate = new Map(records.map((r) => [r.date, r]))

  const summary = {
    dateFrom,
    dateTo,
    totalCalendarDays: days.length,
    byStatus: {},
    successfulReleaseApiDays: 0,
    successfulBulkRecoveryDays: 0,
    unresolvedUnavailableDays: 0,
    partialDays: 0,
    pendingDays: 0,
    totalSourceRecords: 0,
    totalMatched: 0,
    totalMissingLocally: 0,
    totalFieldMismatches: 0,
    days: [],
  }

  for (const day of days) {
    const rec = byDate.get(day) || { date: day, status: DAY_STATUS.PENDING }
    const status = rec.status || DAY_STATUS.PENDING
    summary.byStatus[status] = (summary.byStatus[status] || 0) + 1
    if (status === DAY_STATUS.SUCCESS && rec.sourceType !== 'OCDS_BULK_TRANSPARENCY') {
      summary.successfulReleaseApiDays += 1
    }
    if (status === DAY_STATUS.SUCCESS && rec.sourceType === 'OCDS_BULK_TRANSPARENCY') {
      summary.successfulBulkRecoveryDays += 1
    }
    if (status === DAY_STATUS.SOURCE_UNAVAILABLE) summary.unresolvedUnavailableDays += 1
    if (status === DAY_STATUS.PARTIAL) summary.partialDays += 1
    if (status === DAY_STATUS.PENDING) summary.pendingDays += 1
    summary.totalSourceRecords += Number(rec.sourceCount) || 0
    summary.totalMatched += Number(rec.matchedCount) || 0
    summary.totalMissingLocally += Number(rec.missingLocallyCount) || 0
    summary.totalFieldMismatches += Number(rec.fieldMismatchCount) || 0
    summary.days.push({
      date: day,
      status,
      sourceType: rec.sourceType || null,
      attemptCount: rec.attemptCount || 0,
      sourceCount: rec.sourceCount || 0,
      missingLocallyCount: rec.missingLocallyCount || 0,
      fieldMismatchCount: rec.fieldMismatchCount || 0,
      httpStatus: rec.httpStatus,
      lastSuccessAt: rec.lastSuccessAt || null,
      nextRetryAt: rec.nextRetryAt || null,
      error: rec.error || null,
      certified: rec.certified === true,
    })
  }

  return summary
}

module.exports = {
  CURSOR_COLLECTION_HINT,
  planBackfill,
  runBackfillTick,
  summarizeRange,
  shouldProcessDay,
  loadCursor,
  saveCursor,
}
