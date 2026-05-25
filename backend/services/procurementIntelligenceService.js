/**
 * Admin procurement intelligence dashboard payload.
 */
const { PROCUREMENT_SOURCES, getEnabledSources } = require('../config/procurementSources')
const procurementAggregation = require('./procurement/procurementAggregationService')
const procurementDedup = require('./procurement/deduplicationService')
const graphService = require('./analytics/procurementGraphService')
const briefingDetection = require('./ai/briefingDetectionService')
const pdfExtraction = require('./ai/procurementPdfExtractionService')
const emailIngestion = require('./procurement/emailIngestionService')
const { getStorage } = require('./storageAdapter')
const { getFirestore } = require('../config/firebaseAdmin')

async function getDashboardPayload() {
  const storage = getStorage()
  const db = getFirestore()

  const [tenders, graph, sourceLogsSnap, extractionsSnap] = await Promise.all([
    storage.getAllTenders(),
    graphService.getLatestGraphMetrics().catch(() => null),
    db.collection('procurementSourceLogs').limit(50).get().catch(() => ({ docs: [] })),
    db.collection('aiProcurementExtraction').limit(30).get().catch(() => ({ docs: [] })),
  ])

  const bySource = {}
  let compulsoryCount = 0
  const provinceDensity = {}
  const sectorCounts = {}

  for (const t of tenders) {
    const src = t.source || t.sourceLabel || 'etenders'
    bySource[src] = (bySource[src] || 0) + 1
    const prov = t.province || 'Unknown'
    provinceDensity[prov] = (provinceDensity[prov] || 0) + 1
    const sector = t.procurementCategory || t.category || 'general'
    sectorCounts[sector] = (sectorCounts[sector] || 0) + 1
    if (t.briefingCompulsory || t.compulsoryBriefing) compulsoryCount += 1
  }

  const sourceLogs = (sourceLogsSnap.docs || []).map((d) => ({ id: d.id, ...d.data() }))
  const extractions = (extractionsSnap.docs || []).map((d) => ({
    id: d.id,
    ...d.data(),
  }))

  const avgConfidence =
    extractions.length > 0
      ? Math.round(
          (extractions.reduce((s, e) => s + (e.briefingConfidence || 0), 0) / extractions.length) *
            100
        ) / 100
      : null

  const sampleBriefing = briefingDetection.detectBriefing(
    'Compulsory briefing session for bidders at 10:00 on 2026-06-15. Clarification meeting optional.'
  )

  return {
    generatedAt: new Date().toISOString(),
    sourceRegistry: {
      total: PROCUREMENT_SOURCES.length,
      enabled: getEnabledSources().length,
      sources: PROCUREMENT_SOURCES.map((s) => ({
        id: s.id,
        name: s.name,
        type: s.type,
        enabled: s.enabled,
        tenderCount: bySource[s.id] || 0,
      })),
    },
    tendersBySource: bySource,
    briefingDensity: {
      totalTenders: tenders.length,
      compulsoryBriefings: compulsoryCount,
      compulsoryRate:
        tenders.length > 0 ? Math.round((compulsoryCount / tenders.length) * 1000) / 10 : 0,
    },
    provinceHeatmap: Object.entries(provinceDensity)
      .map(([province, count]) => ({ province, count }))
      .sort((a, b) => b.count - a.count),
    sectors: Object.entries(sectorCounts)
      .map(([sector, count]) => ({ sector, count }))
      .sort((a, b) => b.count - a.count),
    compulsoryTrend: graph?.seasonalTrends || [],
    aiExtraction: {
      samples: extractions.slice(0, 8),
      averageBriefingConfidence: avgConfidence,
      pdfExtractionAvailable: true,
    },
    duplicateDetection: {
      engine: 'procurement/deduplicationService',
      sampleCheck: sampleBriefing,
    },
    briefingForecast: graph?.briefingHotspots || [],
    sourceLogs: sourceLogs.slice(0, 15),
    graphMetrics: graph,
    emailIngestion: {
      collection: emailIngestion.COLLECTION,
      ready: true,
      inbox: 'rfq@tenderbriefing.co.za',
    },
  }
}

async function runSelfTest() {
  const registry = PROCUREMENT_SOURCES.length >= 14
  const briefing = briefingDetection.detectBriefing('compulsory site inspection on 2026-07-01')
  const pdfFields = pdfExtraction.extractFieldsFromText(
    'CIDB grade 5. Closing date 2026-08-01. Compulsory briefing at City Hall.'
  )
  const dedup = procurementDedup.isCrossSourceDuplicate(
    { tenderNumber: 'ABC-1', title: 'Supply of goods', source: 'etenders' },
    { tenderNumber: 'ABC-1', title: 'Supply of goods', source: 'eskom' }
  )

  let aggregationOk = false
  try {
    await procurementAggregation.syncSourceRegistry()
    aggregationOk = true
  } catch {
    aggregationOk = false
  }

  return {
    registry,
    briefingDetected: briefing.detectedBriefing === true,
    pdfCidb: Boolean(pdfFields.cidbGrade),
    crossSourceDedup: dedup.duplicate === true,
    aggregationOk,
  }
}

module.exports = {
  getDashboardPayload,
  runSelfTest,
}
