const { getStorage } = require('./storageAdapter')
const { createEmptyTenderBriefing, contentHash } = require('./tenderModel')
const { findDuplicateInList } = require('./deduplicationService')
const { processTender } = require('./tenderPipeline')
const auditLogService = require('./auditLogService')
const { SOURCE_LABEL } = require('./tenderModel')

const OCDS_API_BASE = 'https://ocds-api.etenders.gov.za/api/OCDSReleases'
const PAGE_SIZE = 100
const MAX_PAGES_INCREMENTAL = 20
const MAX_PAGES_FULL = 200

function formatDate(d) {
  return d.toISOString().slice(0, 10)
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

function extractTime(isoDate) {
  try {
    const d = new Date(isoDate)
    return d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

async function fetchOcdsPage(dateFrom, dateTo, pageNumber = 1) {
  const url = `${OCDS_API_BASE}?dateFrom=${dateFrom}&dateTo=${dateTo}&PageNumber=${pageNumber}&PageSize=${PAGE_SIZE}`

  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(120000),
  })

  if (!response.ok) {
    throw new Error(`OCDS API error ${response.status}: ${await response.text()}`)
  }

  return response.json()
}

function formatFetchError(error) {
  const cause = error?.cause?.message || error?.cause?.code
  return cause ? `${error.message} (${cause})` : error.message
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

async function fetchReleasesInRange(dateFrom, dateTo, maxPages) {
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

  return releases
}

function isNightlyReconciliationWindow() {
  const hour = new Date().getHours()
  return hour >= 2 && hour <= 4
}

async function runSync(options = {}) {
  const storage = getStorage()
  const state = await storage.getSyncState()

  if (state.isRunning && !options.force) {
    return { success: false, message: 'Sync already running', state }
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

  const syncLog = {
    id: `sync-${Date.now()}`,
    startedAt: new Date().toISOString(),
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
    const releases = await fetchReleasesInRange(dateFrom, dateTo, maxPages)
    const existingTenders = await storage.getTenderBriefings()
    const tendersToUpsert = []

    state.apiHealth = 'healthy'

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
    state.lastError = stats.errors[0] || null
    state.apiHealth = 'healthy'
    state.scraperHealth = 'standby'

    await storage.saveSyncState(state)

    await auditLogService.logEvent({
      type: 'api_sync_complete',
      mode: syncLog.mode,
      ...stats,
    })

    return {
      success: true,
      stats,
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
    const preservedCount = (await storage.getTenderBriefings()).length

    state.isRunning = false
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
  const tenders = await storage.getTenderBriefings()
  const lastFailed = getLastFailedSyncLog(state.syncLogs)
  const lastSuccess = getLastSuccessfulSyncLog(state.syncLogs)

  return {
    ...state,
    tenderCount: tenders.length,
    compulsoryCount: tenders.filter((t) => t.briefingCompulsory).length,
    lastUpdated: state.lastSuccessfulSync,
    lastFailedSyncAt: state.lastFailedSync || lastFailed?.startedAt || null,
    lastFailedSyncError: lastFailed?.error || state.lastError || null,
    lastSuccessfulSyncProcessed: lastSuccess?.processed ?? null,
    storageAdapter: process.env.STORAGE_ADAPTER || 'json',
  }
}

module.exports = {
  OCDS_API_BASE,
  parseOcdsRelease,
  fetchOcdsPage,
  fetchReleasesInRange,
  runSync,
  getSyncStatus,
  shouldIncludeTender,
}
