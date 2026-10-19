const { getStorage } = require('./storageAdapter')
const {
  createEmptyTenderBriefing,
  contentHash,
  SOURCE_LABEL,
  hashRawRelease,
  buildRawSourceSnapshot,
  deriveBriefingStatus,
  catalogueCompulsoryFromDerived,
  DERIVED_BRIEFING_STATUS,
} = require('./tenderModel')
const { findDuplicateInList } = require('./deduplicationService')
const { processTender } = require('./tenderPipeline')
const auditLogService = require('./auditLogService')
const {
  DEFAULT_OCDS_API_BASE,
  CONNECT_TIMEOUT_MS,
  REQUEST_TIMEOUT_MS,
  MAX_ATTEMPTS,
  getOcdsApiBase,
  formatFetchError,
  fetchWithRetry,
} = require('./ocdsHttpClient')

/** @deprecated Prefer getOcdsApiBase() — kept for callers/tests expecting a constant. */
const OCDS_API_BASE = DEFAULT_OCDS_API_BASE
const PAGE_SIZE = 100
/**
 * Soft safety ceilings only — sync must follow links.next until exhausted.
 * Hitting a ceiling marks the run INCOMPLETE (never silent success).
 */
const MAX_PAGES_INCREMENTAL = 500
const MAX_PAGES_FULL = 2000
/** Soft cap per calendar day; overflow → truncatedDays + INCOMPLETE. */
const MAX_PAGES_PER_DAY = 200
/** Cloud Run sync maxDuration is 300s — treat locks older than this as abandoned. */
const STALE_LOCK_MS = 20 * 60 * 1000

const SYNC_RUN_STATUS = Object.freeze({
  COMPLETE: 'COMPLETE',
  INCOMPLETE: 'INCOMPLETE',
  FAILED: 'FAILED',
  RUNNING: 'running',
})

function formatDate(d) {
  return d.toISOString().slice(0, 10)
}

/** Inclusive YYYY-MM-DD calendar days between dateFrom and dateTo (UTC date parts). */
function eachDateInclusive(dateFrom, dateTo) {
  const start = String(dateFrom || '').slice(0, 10)
  const end = String(dateTo || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    return start && end && start === end ? [start] : []
  }
  const days = []
  const cursor = new Date(`${start}T00:00:00.000Z`)
  const last = new Date(`${end}T00:00:00.000Z`)
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(last.getTime()) || cursor > last) {
    return []
  }
  while (cursor <= last) {
    days.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return days
}

function isSkippableOcdsDayError(error) {
  const message = error instanceof Error ? error.message : String(error || '')
  return (
    /OCDS API error (500|502|503|504)\b/.test(message) ||
    /OCDS fetch failed after/.test(message)
  )
}

/**
 * Map OCDS compulsory field without inventing a boolean.
 * @returns {null|boolean}
 */
function parseSourceCompulsory(value) {
  if (value === true || value === false) return value
  if (value == null || value === '') return null
  if (typeof value === 'string') {
    const s = value.trim().toLowerCase()
    if (s === 'true' || s === 'yes' || s === '1') return true
    if (s === 'false' || s === 'no' || s === '0') return false
  }
  return null
}

function parseOcdsRelease(release) {
  const tender = release.tender || {}
  const buyer = release.buyer || tender.procuringEntity || {}
  const briefing = tender.briefingSession || {}
  const contact = tender.contactPerson || {}

  const briefingDateRaw = briefing.date || briefing.startDate
  const briefingDate =
    briefingDateRaw && !String(briefingDateRaw).startsWith('0001')
      ? briefingDateRaw
      : ''

  const documents = (tender.documents || []).map((doc) => ({
    id: doc.id || null,
    title: doc.title || null,
    url: doc.url || null,
    format: doc.format || null,
    datePublished: doc.datePublished || null,
    dateModified: doc.dateModified || null,
    documentType: doc.documentType || null,
  }))

  const tenderNumber = tender.id || release.id || ''
  const ocid = release.ocid || ''
  const sourceBriefingCompulsory = parseSourceCompulsory(briefing.compulsory)
  const briefingVenue =
    briefing.venue && briefing.venue !== 'N/A' ? briefing.venue : ''
  const matchedBriefingTerms =
    sourceBriefingCompulsory === true ? ['compulsory briefing'] : []
  const derivedBriefingStatus = deriveBriefingStatus(sourceBriefingCompulsory, {
    briefingCompulsory: sourceBriefingCompulsory === true,
    briefingVenue,
    briefingDate,
    matchedBriefingTerms,
  })
  const nowIso = new Date().toISOString()

  return createEmptyTenderBriefing({
    id: `tb-${tenderNumber || ocid.replace(/[^a-z0-9]/gi, '')}`,
    ocid,
    tenderNumber: String(tenderNumber),
    title: tender.title || '',
    description: tender.description || tender.title || '',
    department: buyer.name || tender.procuringEntity?.name || '',
    buyer: buyer.name || '',
    province: tender.province || '',
    category: tender.category || tender.mainProcurementCategory || '',
    procurementMethod: tender.procurementMethodDetails || tender.procurementMethod || '',
    status: mapStatus(tender.status),
    publishedDate: release.date || tender.tenderPeriod?.startDate || '',
    closingDate: tender.tenderPeriod?.endDate || '',
    briefingDate,
    briefingTime: briefingDate ? extractTime(briefingDate) : '',
    briefingVenue,
    sourceBriefingCompulsory,
    derivedBriefingStatus,
    briefingCompulsory: catalogueCompulsoryFromDerived(derivedBriefingStatus),
    briefingConfidence:
      sourceBriefingCompulsory === true
        ? 0.85
        : briefing.isSession
          ? 0.5
          : 0.2,
    matchedBriefingTerms,
    contactPerson: contact.name || '',
    contactEmail: contact.email || '',
    contactPhone: contact.telephoneNumber || '',
    documents,
    detailUrl: tenderNumber
      ? `https://www.etenders.gov.za/Home/opportunity?id=${tenderNumber}`
      : '',
    deliveryLocation: tender.deliveryLocation || '',
    source: SOURCE_LABEL,
    sourceReleaseId: release.id || '',
    sourcePublishedAt: release.date || '',
    sourceModifiedAt: release.date || '',
    ingestedAt: nowIso,
    scrapedAt: nowIso,
    rawSourceHash: hashRawRelease(release),
    rawSourceSnapshot: buildRawSourceSnapshot(release),
  })
}

function mapStatus(status) {
  const s = (status || '').toLowerCase()
  if (s === 'complete' || s === 'closed') return 'closed'
  if (s === 'cancelled') return 'cancelled'
  return 'active'
}

/**
 * OCDS stamps SA wall-clock briefing times with a `Z` designator (an 11:00 briefing
 * arrives as `...T11:00:00Z`), so the literal clock in the string is already SAST.
 * Reading it directly keeps the stored value identical no matter which timezone the
 * sync container runs in.
 */
function extractTime(isoDate) {
  const raw = String(isoDate || '').trim()
  const wallClock = raw.match(/T(\d{2}):(\d{2})/)
  if (wallClock && !/[+-]\d{2}:?\d{2}$/.test(raw)) {
    return `${wallClock[1]}:${wallClock[2]}`
  }

  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return ''

  return new Intl.DateTimeFormat('en-ZA', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Africa/Johannesburg',
  }).format(d)
}

async function fetchOcdsPage(dateFrom, dateTo, pageNumber = 1) {
  const base = getOcdsApiBase()
  const url = `${base}?dateFrom=${dateFrom}&dateTo=${dateTo}&PageNumber=${pageNumber}&PageSize=${PAGE_SIZE}`

  const response = await fetchWithRetry(url)

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    const snippet = body ? body.slice(0, 300) : ''
    throw new Error(
      snippet
        ? `OCDS API error ${response.status}: ${snippet}`
        : `OCDS API error ${response.status}`
    )
  }

  return response.json()
}

/**
 * Phase 17 — INGEST FIRST.
 * Persist every successfully parsed OCDS release. Catalogue eligibility is
 * presentation-layer only (`briefingCompulsory` + upcoming on /tenders).
 * @deprecated Kept for tests/callers; always returns true.
 */
function shouldIncludeTender(_tender) {
  return true
}

/**
 * @returns {{ releases: object[], pagesFetched: number, truncated: boolean, hasMore: boolean }}
 */
async function fetchReleasesForDay(day, maxPages) {
  const releases = []
  let page = 1
  let hasMore = true
  const dayMax = Math.max(1, Math.min(MAX_PAGES_PER_DAY, maxPages || MAX_PAGES_PER_DAY))
  // Prefer export binding so unit tests can spy on fetchOcdsPage.
  const fetchPage = module.exports.fetchOcdsPage || fetchOcdsPage

  while (hasMore && page <= dayMax) {
    const data = await fetchPage(day, day, page)
    const batch = data.releases || []
    releases.push(...batch)
    hasMore = !!(data.links?.next && batch.length === PAGE_SIZE)
    page += 1
  }

  const pagesFetched = Math.max(0, page - 1)
  return {
    releases,
    pagesFetched,
    truncated: hasMore,
    hasMore,
  }
}

/**
 * Fetch OCDS releases day-by-day.
 * National Treasury's API intermittently returns HTTP 500 for some calendar days
 * and for multi-day windows that include those days. Chunking + skip keeps sync
 * moving instead of failing the entire lookback range.
 *
 * Truncation / skipped days mark the overall run INCOMPLETE — never silent success.
 *
 * @returns {{ releases: object[], dayErrors: {day:string,error:string}[], daysRequested: number, daysSucceeded: number, truncatedDays: string[], pagesProcessed: number, incomplete: boolean }}
 */
async function fetchReleasesInRange(dateFrom, dateTo, maxPages) {
  const days = eachDateInclusive(dateFrom, dateTo)
  if (!days.length) {
    // Fallback: single window (legacy behaviour) when dates are malformed
    const releases = []
    let page = 1
    let hasMore = true
    const pageCap = Math.max(1, Number(maxPages) || MAX_PAGES_INCREMENTAL)
    while (hasMore && page <= pageCap) {
      const data = await fetchOcdsPage(dateFrom, dateTo, page)
      const batch = data.releases || []
      releases.push(...batch)
      hasMore = !!(data.links?.next && batch.length === PAGE_SIZE)
      page += 1
    }
    return {
      releases,
      dayErrors: [],
      daysRequested: 0,
      daysSucceeded: 0,
      truncatedDays: hasMore ? [`${dateFrom}..${dateTo}`] : [],
      pagesProcessed: Math.max(0, page - 1),
      incomplete: hasMore,
    }
  }

  const releases = []
  const dayErrors = []
  const truncatedDays = []
  let pagesProcessed = 0
  let pagesBudget = Math.max(1, Number(maxPages) || MAX_PAGES_INCREMENTAL)
  let daysSucceeded = 0
  let budgetExhausted = false

  for (let i = 0; i < days.length; i++) {
    const day = days[i]
    if (pagesBudget <= 0) {
      budgetExhausted = true
      truncatedDays.push(...days.slice(i))
      break
    }
    const dayMax = Math.min(MAX_PAGES_PER_DAY, pagesBudget)
    try {
      const dayResult = await fetchReleasesForDay(day, dayMax)
      const pagesUsed = Math.max(1, dayResult.pagesFetched || 1)
      pagesBudget -= pagesUsed
      pagesProcessed += pagesUsed
      releases.push(...(dayResult.releases || []))
      daysSucceeded += 1
      if (dayResult.truncated) {
        truncatedDays.push(day)
      }
    } catch (error) {
      if (isSkippableOcdsDayError(error)) {
        const message = error instanceof Error ? error.message : String(error)
        dayErrors.push({ day, error: message.slice(0, 200) })
        console.warn(`[ocdsSync] skipping unhealthy day ${day}:`, message.slice(0, 160))
        continue
      }
      throw error
    }
  }

  if (!releases.length && dayErrors.length && daysSucceeded === 0) {
    throw new Error(
      `OCDS API failed for all ${days.length} day(s) in ${dateFrom}..${dateTo}: ${dayErrors[0].error}`
    )
  }

  const incomplete =
    dayErrors.length > 0 || truncatedDays.length > 0 || budgetExhausted

  return {
    releases,
    dayErrors,
    daysRequested: days.length,
    daysSucceeded,
    truncatedDays,
    pagesProcessed,
    incomplete,
  }
}

function isNightlyReconciliationWindow() {
  const hour = new Date().getHours()
  return hour >= 2 && hour <= 4
}

function runningSyncStartedAt(state) {
  const runningLog = (state.syncLogs || []).find((log) => log.status === 'running')
  return runningLog?.startedAt || state.lockAcquiredAt || null
}

function isStaleRunningLock(state) {
  if (!state.isRunning) return false
  const startedAt = runningSyncStartedAt(state)
  if (!startedAt) return true
  const ageMs = Date.now() - new Date(startedAt).getTime()
  return Number.isNaN(ageMs) || ageMs > STALE_LOCK_MS
}

function clearStaleRunningLock(state, reason = 'stale_lock_cleared') {
  const nowIso = new Date().toISOString()
  state.syncLogs = (state.syncLogs || []).map((log) =>
    log.status === 'running'
      ? {
          ...log,
          status: 'failed',
          error: reason,
          completedAt: nowIso,
        }
      : log
  )
  state.isRunning = false
  state.lockAcquiredAt = null
  state.lastError = reason
  state.lastFailedSync = nowIso
  return state
}

async function runSync(options = {}) {
  const storage = getStorage()
  const state = await storage.getSyncState()

  if (state.isRunning && !options.force) {
    if (isStaleRunningLock(state)) {
      const staleStartedAt = runningSyncStartedAt(state)
      clearStaleRunningLock(state)
      await storage.saveSyncState(state)
      await auditLogService.logEvent({
        type: 'api_sync_stale_lock_cleared',
        startedAt: staleStartedAt,
        staleLockMs: STALE_LOCK_MS,
      })
    } else {
      return { success: false, message: 'Sync already running', state }
    }
  }

  const fullReconciliation =
    options.fullReconciliation === true || isNightlyReconciliationWindow()

  const now = new Date()
  const dateTo = formatDate(now)
  let dateFrom

  if (fullReconciliation) {
    const lookback = new Date(now)
    lookback.setDate(lookback.getDate() - 30)
    dateFrom = formatDate(lookback)
  } else if (state.lastSuccessfulSync) {
    const last = new Date(state.lastSuccessfulSync)
    last.setDate(last.getDate() - 1)
    dateFrom = formatDate(last)
  } else {
    const lookback = new Date(now)
    lookback.setDate(lookback.getDate() - 7)
    dateFrom = formatDate(lookback)
  }

  const startedAt = new Date().toISOString()
  const watermarkBefore = state.lastSuccessfulSync || null
  const syncLog = {
    id: `sync-${Date.now()}`,
    startedAt,
    mode: fullReconciliation ? 'full_reconciliation' : 'incremental',
    dateFrom,
    dateTo,
    status: SYNC_RUN_STATUS.RUNNING,
    mirrorStatus: null,
    processed: 0,
    added: 0,
    updated: 0,
    skipped: 0,
    unchanged: 0,
    sourceDiscovered: 0,
    documentsDiscovered: 0,
    pagesProcessed: 0,
    truncatedDays: [],
    watermarkBefore,
    watermarkAfter: null,
    errors: [],
  }

  state.isRunning = true
  state.lockAcquiredAt = startedAt
  state.syncLogs = [syncLog, ...(state.syncLogs || [])].slice(0, 50)
  await storage.saveSyncState(state)

  await auditLogService.logEvent({
    type: 'api_sync_start',
    mode: syncLog.mode,
    dateFrom,
    dateTo,
  })

  const stats = {
    processed: 0,
    added: 0,
    updated: 0,
    skipped: 0,
    unchanged: 0,
    documentsDiscovered: 0,
    errors: [],
  }

  try {
    const maxPages = fullReconciliation ? MAX_PAGES_FULL : MAX_PAGES_INCREMENTAL
    const fetchResult = await fetchReleasesInRange(dateFrom, dateTo, maxPages)
    const releases = fetchResult.releases || []
    const dayErrors = fetchResult.dayErrors || []
    const truncatedDays = fetchResult.truncatedDays || []
    const incompleteFetch = fetchResult.incomplete === true
    const existingTenders = await storage.getTenderBriefings()
    const tendersToUpsert = []

    state.apiHealth = dayErrors.length || truncatedDays.length ? 'degraded' : 'healthy'
    syncLog.daysRequested = fetchResult.daysRequested
    syncLog.daysSucceeded = fetchResult.daysSucceeded
    syncLog.sourceDiscovered = releases.length
    syncLog.pagesProcessed = fetchResult.pagesProcessed || 0
    syncLog.truncatedDays = truncatedDays.slice(0, 31)
    if (dayErrors.length) {
      syncLog.dayErrors = dayErrors.slice(0, 14)
    }

    for (const release of releases) {
      try {
        const mapped = parseOcdsRelease(release)
        stats.documentsDiscovered += (mapped.documents || []).length

        const duplicate = findDuplicateInList(existingTenders, mapped)
        // Preserve prior ingestedAt / history identity on update
        if (duplicate?.ingestedAt) {
          mapped.ingestedAt = duplicate.ingestedAt
        }
        if (duplicate?.sourceBriefingCompulsory !== undefined && mapped.sourceBriefingCompulsory == null) {
          // Prefer fresh OCDS null over stale invented false — already null from parse
        }

        const unchanged =
          duplicate &&
          duplicate.contentHash &&
          duplicate.contentHash === contentHash(mapped) &&
          duplicate.rawSourceHash &&
          duplicate.rawSourceHash === mapped.rawSourceHash

        if (unchanged) {
          stats.unchanged += 1
          stats.skipped += 1
          continue
        }

        // Enrich docs when source compulsory is unknown/false (may promote derived).
        // Skip heavy PDF work when OCDS already confirmed compulsory (unless full recon).
        const skipDocuments =
          !fullReconciliation && mapped.sourceBriefingCompulsory === true

        const processed = await processTender(mapped, duplicate, { skipDocuments })

        tendersToUpsert.push(processed)

        const memIndex = existingTenders.findIndex((t) => t.id === processed.id)
        if (memIndex >= 0) existingTenders[memIndex] = processed
        else existingTenders.push(processed)

        if (duplicate) stats.updated += 1
        else stats.added += 1

        stats.processed += 1
      } catch (error) {
        stats.errors.push(error.message)
        await auditLogService.logEvent({
          type: 'failed_tender',
          ocid: release?.ocid,
          error: error.message,
        })
      }
    }

    if (tendersToUpsert.length > 0) {
      const upsertResult = await storage.upsertTenders(tendersToUpsert)
      syncLog.upserted = upsertResult?.written ?? tendersToUpsert.length
      syncLog.storageAdapter = storage.adapterType || process.env.STORAGE_ADAPTER || 'json'
    }

    const mirrorIncomplete =
      incompleteFetch || dayErrors.length > 0 || truncatedDays.length > 0
    const mirrorStatus = mirrorIncomplete
      ? SYNC_RUN_STATUS.INCOMPLETE
      : SYNC_RUN_STATUS.COMPLETE

    // Legacy status field kept for admin UI; mirrorStatus is authoritative.
    syncLog.status = mirrorIncomplete ? 'completed' : 'completed'
    syncLog.mirrorStatus = mirrorStatus
    syncLog.completedAt = new Date().toISOString()
    syncLog.processed = stats.processed
    syncLog.added = stats.added
    syncLog.updated = stats.updated
    syncLog.skipped = stats.skipped
    syncLog.unchanged = stats.unchanged
    syncLog.documentsDiscovered = stats.documentsDiscovered
    syncLog.errors = stats.errors
    syncLog.incomplete = mirrorIncomplete

    const nowIso = new Date().toISOString()
    // Only advance watermark on COMPLETE mirror — incomplete days must be retried.
    if (!mirrorIncomplete) {
      state.lastSuccessfulSync = nowIso
      syncLog.watermarkAfter = nowIso
      state.lastIncrementalSync = fullReconciliation
        ? state.lastIncrementalSync
        : state.lastSuccessfulSync
      if (fullReconciliation) {
        state.lastFullReconciliation = state.lastSuccessfulSync
      }
    } else {
      syncLog.watermarkAfter = watermarkBefore
      state.lastIncompleteSync = nowIso
      state.lastIncompleteReason = [
        dayErrors.length ? `skippedDays=${dayErrors.length}` : null,
        truncatedDays.length ? `truncatedDays=${truncatedDays.length}` : null,
      ]
        .filter(Boolean)
        .join('; ')
    }
    state.isRunning = false
    state.lockAcquiredAt = null
    state.lastError = mirrorIncomplete
      ? `INCOMPLETE OCDS sync: skipped=${dayErrors.length} truncated=${truncatedDays.length}`
      : stats.errors[0] || null
    state.apiHealth =
      dayErrors.length || truncatedDays.length ? 'degraded' : 'healthy'
    state.scraperHealth = 'standby'
    state.tenderCount = existingTenders.length
    state.compulsoryCount = existingTenders.filter((t) => t.briefingCompulsory).length
    state.mirrorStatus = mirrorStatus

    await storage.saveSyncState(state)

    try {
      const catalogueStats = require('./catalogueStatsService')
      await catalogueStats.writeCatalogueSummary(existingTenders, {
        tenderCount: existingTenders.length,
      })
    } catch (err) {
      console.warn(
        '[sync] catalogue summary write skipped:',
        err instanceof Error ? err.message.slice(0, 120) : 'unknown'
      )
    }

    await auditLogService.logEvent({
      type: 'api_sync_complete',
      mode: syncLog.mode,
      mirrorStatus,
      ...stats,
      daysRequested: fetchResult.daysRequested,
      daysSucceeded: fetchResult.daysSucceeded,
      dayErrorCount: dayErrors.length,
      truncatedDayCount: truncatedDays.length,
      pagesProcessed: fetchResult.pagesProcessed,
      sourceDiscovered: releases.length,
    })

    return {
      success: true,
      partial: mirrorIncomplete,
      incomplete: mirrorIncomplete,
      mirrorStatus,
      stats: {
        ...stats,
        dayErrors: dayErrors.length,
        truncatedDays: truncatedDays.length,
        sourceDiscovered: releases.length,
      },
      syncLog,
      state,
      storageAdapter: storage.adapterType || process.env.STORAGE_ADAPTER || 'json',
    }
  } catch (error) {
    const message = formatFetchError(error)
    syncLog.status = 'failed'
    syncLog.mirrorStatus = SYNC_RUN_STATUS.FAILED
    syncLog.error = message
    syncLog.completedAt = new Date().toISOString()

    // Preserve last good dataset — never delete tenders on sync failure
    let preservedCount = Number(state.preservedTenderCount || state.tenderCount || 0)
    try {
      if (typeof storage.countDocuments === 'function') {
        preservedCount = await storage.countDocuments('tenderBriefings')
      }
    } catch {
      /* keep previous */
    }

    state.isRunning = false
    state.lockAcquiredAt = null
    state.lastError = message
    state.lastFailedSync = new Date().toISOString()
    state.apiHealth = 'unhealthy'
    state.preservedTenderCount = preservedCount
    await storage.saveSyncState(state)

    await auditLogService.logEvent({
      type: 'api_sync_failed',
      error: message,
      preservedTenderCount: preservedCount,
      note: 'Existing tenderBriefings preserved',
    })

    return {
      success: false,
      error: message,
      syncLog,
      state,
      preservedTenderCount: preservedCount,
      storageAdapter: storage.adapterType || process.env.STORAGE_ADAPTER || 'json',
    }
  }
}

function getLastFailedSyncLog(syncLogs = []) {
  return syncLogs.find((log) => log.status === 'failed') || null
}

function getLastSuccessfulSyncLog(syncLogs = []) {
  return syncLogs.find((log) => log.status === 'completed') || null
}

async function getSyncStatus() {
  const storage = getStorage()
  const state = await storage.getSyncState()
  const lastFailed = getLastFailedSyncLog(state.syncLogs)
  const lastSuccess = getLastSuccessfulSyncLog(state.syncLogs)

  let tenderCount = Number(state.tenderCount || state.preservedTenderCount || 0)
  let compulsoryCount = Number(state.compulsoryCount || 0)
  try {
    const catalogueStats = require('./catalogueStatsService')
    const summary = await catalogueStats.readCatalogueSummary()
    if (summary?.tenderCount != null) tenderCount = Number(summary.tenderCount)
    if (summary?.compulsoryBriefings != null) compulsoryCount = Number(summary.compulsoryBriefings)
  } catch {
    if (typeof storage.countDocuments === 'function' && !tenderCount) {
      try {
        tenderCount = await storage.countDocuments('tenderBriefings')
      } catch {
        /* leave 0 */
      }
    }
  }

  return {
    ...state,
    tenderCount,
    compulsoryCount,
    lastUpdated: state.lastSuccessfulSync,
    lastFailedSyncAt: state.lastFailedSync || lastFailed?.startedAt || null,
    lastFailedSyncError: lastFailed?.error || state.lastError || null,
    lastSuccessfulSyncProcessed: lastSuccess?.processed ?? null,
    storageAdapter: process.env.STORAGE_ADAPTER || 'json',
  }
}

module.exports = {
  OCDS_API_BASE,
  CONNECT_TIMEOUT_MS,
  REQUEST_TIMEOUT_MS,
  MAX_FETCH_ATTEMPTS: MAX_ATTEMPTS,
  STALE_LOCK_MS,
  MAX_PAGES_PER_DAY,
  MAX_PAGES_INCREMENTAL,
  MAX_PAGES_FULL,
  PAGE_SIZE,
  SYNC_RUN_STATUS,
  DERIVED_BRIEFING_STATUS,
  getOcdsApiBase,
  parseOcdsRelease,
  parseSourceCompulsory,
  fetchOcdsPage,
  fetchReleasesForDay,
  fetchReleasesInRange,
  eachDateInclusive,
  isSkippableOcdsDayError,
  runSync,
  getSyncStatus,
  shouldIncludeTender,
  isStaleRunningLock,
  clearStaleRunningLock,
  formatFetchError,
}
