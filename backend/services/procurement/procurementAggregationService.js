/**
 * Multi-source procurement aggregation — normalize, dedupe, enrich, persist.
 */
const { getEnabledSources, getSourceById, PROCUREMENT_SOURCES } = require('../../config/procurementSources')
const { getFirestore } = require('../../config/firebaseAdmin')
const { sanitizeFirestoreData } = require('../../utils/sanitizeFirestoreData')
const { getStorage } = require('../storageAdapter')
const procurementDedup = require('./deduplicationService')
const briefingDetection = require('../ai/briefingDetectionService')
const pdfExtraction = require('../ai/procurementPdfExtractionService')
const tenderPipeline = require('../tenderPipeline')
const { createEmptyTenderBriefing } = require('../tenderModel')

const SCRAPER_MAP = {
  city_of_johannesburg: () => require('./sources/municipal/cityOfJoburgScraper'),
  tshwane: () => require('./sources/municipal/tshwaneScraper'),
  ekurhuleni: () => require('./sources/municipal/ekurhuleniScraper'),
  cape_town: () => require('./sources/municipal/capeTownScraper'),
  eskom: () => require('./sources/soe/eskomScraper'),
  transnet: () => require('./sources/soe/transnetScraper'),
  prasa: () => require('./sources/soe/prasaScraper'),
  sanral: () => require('./sources/soe/sanralScraper'),
}

async function logSourceRun(entry) {
  const db = getFirestore()
  const ref = db.collection('procurementSourceLogs').doc()
  await ref.set(
    sanitizeFirestoreData({
      ...entry,
      createdAt: new Date().toISOString(),
    })
  )
  return ref.id
}

async function syncSourceRegistry() {
  const db = getFirestore()
  for (const source of PROCUREMENT_SOURCES) {
    await db
      .collection('procurementSources')
      .doc(source.id)
      .set(
        sanitizeFirestoreData({
          ...source,
          updatedAt: new Date().toISOString(),
        }),
        { merge: true }
      )
  }
}

function normalizeRecord(raw) {
  return {
    source: raw.source,
    tenderNumber: raw.tenderNumber,
    title: raw.title,
    description: raw.description || raw.title,
    department: raw.department,
    province: raw.province,
    closingDate: raw.closingDate || null,
    briefingDate: raw.briefingDate || null,
    briefingVenue: raw.briefingVenue || null,
    compulsoryBriefing: Boolean(raw.compulsoryBriefing),
    category: raw.category,
    cidbGrade: raw.cidbGrade || null,
    attachments: raw.attachments || [],
    aiInsights: raw.aiInsights || null,
    rawSourceData: raw.rawSourceData || {},
  }
}

function toTenderBriefing(record) {
  const base = createEmptyTenderBriefing({
    tenderNumber: record.tenderNumber,
    title: record.title,
    description: record.description,
    department: record.department,
    province: record.province,
    closingDate: record.closingDate,
    briefingDate: record.briefingDate,
    briefingVenue: record.briefingVenue,
    briefingCompulsory: record.compulsoryBriefing,
  })
  return {
    ...base,
    id: base.id || `tb-${record.tenderNumber}`,
    source: record.source,
    sourceLabel: record.source,
    cidbGrade: record.cidbGrade,
    procurementCategory: record.category,
    attachments: record.attachments,
    multiSource: true,
    rawSourceData: record.rawSourceData,
  }
}

async function enrichRecord(record) {
  const text = `${record.title}\n${record.description}`
  const briefing = await briefingDetection.detectAndPersist(record.tenderNumber, text, {
    source: record.source,
  })

  if (!record.briefingDate && briefing.extractedDate) record.briefingDate = briefing.extractedDate
  if (!record.briefingVenue && briefing.extractedVenue) record.briefingVenue = briefing.extractedVenue
  if (briefing.compulsoryBriefing) record.compulsoryBriefing = true

  record.aiInsights = {
    briefingDetection: briefing,
    enrichedAt: new Date().toISOString(),
  }

  const pdfUrl = record.attachments?.find((a) => a.type === 'pdf' || String(a.url).includes('.pdf'))?.url
  if (pdfUrl) {
    const extracted = await pdfExtraction.extractFromUrl(pdfUrl, {
      tenderId: record.tenderNumber,
      source: record.source,
    })
    if (extracted.ok && extracted.data) {
      record.aiInsights.pdfExtraction = extracted.data
      if (extracted.data.closingDate) record.closingDate = extracted.data.closingDate
      if (extracted.data.cidbGrade) record.cidbGrade = extracted.data.cidbGrade
    }
  }

  return record
}

async function runSourceScrape(sourceId) {
  const source = getSourceById(sourceId)
  if (!source) return { ok: false, error: 'unknown_source' }
  if (!source.enabled) return { ok: false, error: 'source_disabled', sourceId }

  const startedAt = new Date().toISOString()

  if (source.scrapeMethod === 'ocds_api') {
    const incrementalSync = require('../incrementalSyncService')
    const sync = await incrementalSync.runSync({ mode: 'incremental' }).catch((e) => ({
      success: false,
      error: e.message,
    }))
    await logSourceRun({
      sourceId,
      status: sync.success === false ? 'failed' : 'completed',
      scrapeMethod: 'ocds_api',
      records: sync.stats?.added || sync.stats?.updated || 0,
      errors: sync.error ? [sync.error] : [],
      startedAt,
    })
    return { sourceId, scrapeMethod: 'ocds_api', ok: sync.success !== false, ...sync }
  }

  const loader = SCRAPER_MAP[sourceId]
  if (!loader) {
    await logSourceRun({
      sourceId,
      status: 'skipped',
      error: 'no_scraper_implementation',
      startedAt,
    })
    return { ok: false, sourceId, error: 'no_scraper_implementation' }
  }

  try {
    const scraper = loader()
    const result = await scraper.scrape()
    await logSourceRun({
      sourceId,
      status: result.ok ? 'completed' : 'partial',
      noticesFound: result.noticesFound,
      records: result.records?.length || 0,
      errors: result.errors || [],
      startedAt,
    })
    return { ok: true, ...result }
  } catch (err) {
    const error = err instanceof Error ? err.message : 'scrape_failed'
    await logSourceRun({ sourceId, status: 'failed', errors: [error], startedAt })
    return { ok: false, sourceId, error }
  }
}

async function ingestNormalizedRecords(records, options = {}) {
  const storage = getStorage()
  const existing = await storage.getAllTenders()
  const { stats: dedupStats } = await procurementDedup.deduplicateBatch(records, existing, {
    titleThreshold: 0.88,
  })

  const toUpsert = []
  let enriched = 0

  for (const raw of records) {
    let record = normalizeRecord(raw)
    const dup = procurementDedup.findDuplicateInList(existing, record)
    if (dup && !options.force) continue

    if (options.enrich !== false) {
      record = await enrichRecord(record)
      enriched += 1
    }

    const tender = toTenderBriefing(record)
    if (options.runPipeline !== false) {
      await tenderPipeline.processTender(tender, { existingTenders: existing }).catch(() => {
        /* pipeline optional */
      })
    }
    toUpsert.push(tender)
    existing.push(tender)
  }

  if (toUpsert.length) {
    await storage.upsertTenders(toUpsert)
  }

  return {
    ingested: toUpsert.length,
    enriched,
    dedupStats,
  }
}

async function runEnabledSourceScrapes(options = {}) {
  await syncSourceRegistry()
  const sources = options.sourceIds
    ? options.sourceIds.map(getSourceById).filter(Boolean)
    : getEnabledSources().filter((s) => s.scrapeMethod !== 'ocds_api' || options.includeEtenders)

  const results = []
  const allRecords = []

  for (const source of sources) {
    if (source.scrapeMethod === 'ocds_api' && !options.includeEtenders) continue
    const scrape = await runSourceScrape(source.id)
    results.push(scrape)
    if (scrape.records?.length) allRecords.push(...scrape.records)
  }

  let ingest = { ingested: 0, dedupStats: { skipped: 0, added: 0 } }
  if (allRecords.length && options.persist !== false) {
    ingest = await ingestNormalizedRecords(allRecords, options)
  }

  return {
    sourcesRun: results.length,
    results,
    ingest,
    totalRecords: allRecords.length,
  }
}

async function runSmartProcurementIngestion(options = {}) {
  const graphService = require('../analytics/procurementGraphService')
  const aggregate = await runEnabledSourceScrapes({
    ...options,
    enrich: true,
    persist: true,
  })
  const graph = await graphService.refreshGraphMetrics()
  return {
    job: 'smart_procurement_ingestion',
    ...aggregate,
    graphMetricsId: graph.id,
  }
}

module.exports = {
  normalizeRecord,
  syncSourceRegistry,
  runSourceScrape,
  ingestNormalizedRecords,
  runEnabledSourceScrapes,
  runSmartProcurementIngestion,
  logSourceRun,
}
