const { getStorage } = require('./storageAdapter')
const { createEmptyTenderBriefing, contentHash } = require('./tenderModel')
const { findDuplicateInList } = require('./deduplicationService')
const { processTender } = require('./tenderPipeline')
const auditLogService = require('./auditLogService')
const { SOURCE_LABEL } = require('./tenderModel')
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
const MAX_PAGES_INCREMENTAL = 20
const MAX_PAGES_FULL = 200
/** Cap pages fetched per calendar day (NT API often 500s on multi-day windows). */
const MAX_PAGES_PER_DAY = 20
/** Cloud Run sync maxDuration is 300s — treat locks older than this as abandoned. */
const STALE_LOCK_MS = 20 * 60 * 1000

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

function parseOcdsRelease(release) {
  const tender = release.tender || {}
  const buyer = release.buyer || tender.procuringEntity || {}
  const briefing = tender.briefingSession || {}
  const contact = tender.contactPerson || {}

  const briefingDateRaw = briefing.date
  const briefingDate =
    briefingDateRaw && !String(briefingDateRaw).startsWith('0001')
      ? briefingDateRaw
      : ''

  const documents = (tender.documents || []).map((doc) => ({
    id: doc.id,
    title: doc.title,
    url: doc.url,
    format: doc.format,
    datePublished: doc.datePublished,
  }))

  const tenderNumber = tender.id || release.id || ''
  const ocid = release.ocid || ''

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
    briefingVenue: briefing.venue && briefing.venue !== 'N/A' ? briefing.venue : '',
    briefingCompulsory: !!briefing.compulsory,
    briefingConfidence: briefing.compulsory ? 0.85 : briefing.isSession ? 0.5 : 0.2,
    matchedBriefingTerms: briefing.compulsory ? ['compulsory briefing'] : [],
    contactPerson: contact.name || '',
    contactEmail: contact.email || '',
    contactPhone: contact.telephoneNumber || '',
    documents,
    detailUrl: tenderNumber
      ? `https://www.etenders.gov.za/Home/opportunity?id=${tenderNumber}`
      : '',
    deliveryLocation: tender.deliveryLocation || '',
    source: SOURCE_LABEL,
    scrapedAt: new Date().toISOString(),
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

function shouldIncludeTender(tender) {
  if (tender.briefingCompulsory) return true
  if (tender.briefingVenue && tender.briefingDate) return true
  const method = (tender.procurementMethod || '').toLowerCase()
  return (
    method.includes('request for quotation') ||
    method.includes('request for proposal') ||
    method.includes('request for bid') ||
    method.includes('rfq') ||
    method.includes('rfp')
  )
}

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

  return releases
}

/**
 * Fetch OCDS releases day-by-day.
 * National Treasury's API intermittently returns HTTP 500 for some calendar days
 * and for multi-day windows that include those days. Chunking + skip keeps sync
 * moving instead of failing the entire lookback range.
 *
 * @returns {{ releases: object[], dayErrors: {day:string,error:string}[], daysRequested: number, daysSucceeded: number }}
 */
async function fetchReleasesInRange(dateFrom, dateTo, maxPages) {
  const days = eachDateInclusive(dateFrom, dateTo)
  if (!days.length) {
    // Fallback: single window (legacy behaviour) when dates are malformed
    const releases = []
    let page = 1
    let hasMore = true
    while (hasMore && page <= maxPages) {
      const data = await fetchOcdsPage(dateFrom, dateTo, page)
      const batch = data.releases || []
      releases.push(...batch)
      hasMore = !!(data.links?.next && batch.length === PAGE_SIZE)
      page += 1
    }
    return { releases, dayErrors: [], daysRequested: 0, daysSucceeded: 0 }
  }

  const releases = []
  const dayErrors = []
  let pagesBudget = Math.max(1, Number(maxPages) || MAX_PAGES_INCREMENTAL)
  let daysSucceeded = 0

  for (const day of days) {
    if (pagesBudget <= 0) break
    const dayMax = Math.min(MAX_PAGES_PER_DAY, pagesBudget)
    try {
      const batch = await fetchReleasesForDay(day, dayMax)
      const pagesUsed = Math.max(1, Math.ceil((batch.length || 1) / PAGE_SIZE))
      pagesBudget -= pagesUsed
      releases.push(...batch)
      daysSucceeded += 1
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

  return {
    releases,
    dayErrors,
    daysRequested: days.length,
    daysSucceeded,
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
  const syncLog = {
    id: `sync-${Date.now()}`,
    startedAt,
    mode: fullReconciliation ? 'full_reconciliation' : 'incremental',
    dateFrom,
    dateTo,
    status: 'running',
    processed: 0,
    added: 0,
    updated: 0,
    skipped: 0,
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

  const stats = { processed: 0, added: 0, updated: 0, skipped: 0, errors: [] }

  try {
    const maxPages = fullReconciliation ? MAX_PAGES_FULL : MAX_PAGES_INCREMENTAL
    const fetchResult = await fetchReleasesInRange(dateFrom, dateTo, maxPages)
    const releases = fetchResult.releases || []
    const dayErrors = fetchResult.dayErrors || []
    const existingTenders = await storage.getTenderBriefings()
    const tendersToUpsert = []

    state.apiHealth = dayErrors.length ? 'degraded' : 'healthy'
    syncLog.daysRequested = fetchResult.daysRequested
    syncLog.daysSucceeded = fetchResult.daysSucceeded
    if (dayErrors.length) {
      syncLog.dayErrors = dayErrors.slice(0, 14)
    }

    for (const release of releases) {
      try {
        const mapped = parseOcdsRelease(release)
        if (!shouldIncludeTender(mapped)) {
          stats.skipped += 1
          continue
        }

        const duplicate = findDuplicateInList(existingTenders, mapped)
        const unchanged =
          duplicate &&
          duplicate.contentHash &&
          duplicate.contentHash === contentHash(mapped)

        if (unchanged) {
          stats.skipped += 1
          continue
        }

        const processed = await processTender(mapped, duplicate, {
          skipDocuments: !fullReconciliation && !mapped.briefingCompulsory,
        })

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

    syncLog.status = 'completed'
    syncLog.completedAt = new Date().toISOString()
    syncLog.processed = stats.processed
    syncLog.added = stats.added
    syncLog.updated = stats.updated
    syncLog.skipped = stats.skipped
    syncLog.errors = stats.errors

    state.lastSuccessfulSync = new Date().toISOString()
    state.lastIncrementalSync = fullReconciliation
      ? state.lastIncrementalSync
      : state.lastSuccessfulSync
    if (fullReconciliation) {
      state.lastFullReconciliation = state.lastSuccessfulSync
    }
    state.isRunning = false
    state.lockAcquiredAt = null
    // Day-skip warnings are observational — do not block advancing lastSuccessfulSync.
    state.lastError = dayErrors.length
      ? `Partial OCDS sync: skipped ${dayErrors.length} unhealthy day(s)`
      : stats.errors[0] || null
    state.apiHealth = dayErrors.length ? 'degraded' : 'healthy'
    state.scraperHealth = 'standby'
    state.tenderCount = existingTenders.length
    state.compulsoryCount = existingTenders.filter((t) => t.briefingCompulsory).length

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
      ...stats,
      daysRequested: fetchResult.daysRequested,
      daysSucceeded: fetchResult.daysSucceeded,
      dayErrorCount: dayErrors.length,
    })

    return {
      success: true,
      partial: dayErrors.length > 0,
      stats: { ...stats, dayErrors: dayErrors.length },
      syncLog,
      state,
      storageAdapter: storage.adapterType || process.env.STORAGE_ADAPTER || 'json',
    }
  } catch (error) {
    const message = formatFetchError(error)
    syncLog.status = 'failed'
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
  getOcdsApiBase,
  parseOcdsRelease,
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
