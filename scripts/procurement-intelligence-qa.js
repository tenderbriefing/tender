#!/usr/bin/env node
/**
 * Phase 18 — Multi-source procurement intelligence QA (no secrets in output).
 */
const fs = require('fs')
const path = require('path')
process.chdir(path.join(__dirname, '..'))
require('./load-env-local').loadEnvLocal()

process.env.STORAGE_ADAPTER = process.env.STORAGE_ADAPTER || 'firestore'
process.env.FIREBASE_PROJECT_ID =
  process.env.FIREBASE_PROJECT_ID || 'tenderbriefing-34679'

const report = { checks: [], passed: false, blockers: [] }

function check(name, ok, detail = '') {
  report.checks.push({ name, ok, detail })
  if (!ok) report.blockers.push(`${name}${detail ? `: ${detail}` : ''}`)
}

function fileExists(rel) {
  return fs.existsSync(path.join(process.cwd(), rel))
}

async function main() {
  const { PROCUREMENT_SOURCES, getEnabledSources } = require('../backend/config/procurementSources')
  check('source registry count', PROCUREMENT_SOURCES.length >= 14, String(PROCUREMENT_SOURCES.length))
  check('etenders source', Boolean(PROCUREMENT_SOURCES.find((s) => s.id === 'etenders')))
  check('enabled sources', getEnabledSources().length >= 10)

  const requiredFiles = [
    'backend/config/procurementSources.js',
    'backend/services/procurement/procurementAggregationService.js',
    'backend/services/procurement/deduplicationService.js',
    'backend/services/procurement/emailIngestionService.js',
    'backend/services/ai/procurementPdfExtractionService.js',
    'backend/services/ai/briefingDetectionService.js',
    'backend/services/analytics/procurementGraphService.js',
    'backend/services/procurementIntelligenceService.js',
    'backend/services/procurement/sources/municipal/cityOfJoburgScraper.js',
    'backend/services/procurement/sources/soe/eskomScraper.js',
    'app/api/admin/procurement-intelligence/route.ts',
    'app/admin/procurement-intelligence/page.tsx',
  ]
  for (const f of requiredFiles) check(`file ${f}`, fileExists(f))

  const rules = fs.readFileSync('firestore.rules', 'utf8')
  for (const col of [
    'procurementSources',
    'aiProcurementExtraction',
    'procurementGraphMetrics',
    'procurementSourceLogs',
    'ingestedProcurementEmails',
  ]) {
    check(`firestore rules ${col}`, rules.includes(`match /${col}/`))
  }

  const briefingDetection = require('../backend/services/ai/briefingDetectionService')
  const detected = briefingDetection.detectBriefing(
    'Compulsory clarification meeting and technical briefing for bidders.'
  )
  check('AI briefing detection', detected.detectedBriefing === true)
  check('briefing confidence', detected.confidence >= 0.75)

  const pdfExtraction = require('../backend/services/ai/procurementPdfExtractionService')
  const fields = pdfExtraction.extractFieldsFromText(
    'CIDB grade 6CE. Closing date 15/06/2026. Compulsory briefing at 10h00.'
  )
  check('PDF field extraction CIDB', Boolean(fields.cidbGrade))
  check('PDF briefing detection', fields.detectedBriefing === true)

  const procurementDedup = require('../backend/services/procurement/deduplicationService')
  const cross = procurementDedup.isCrossSourceDuplicate(
    { tenderNumber: 'T-100', title: 'Supply cables', source: 'etenders' },
    { tenderNumber: 'T-100', title: 'Supply cables', source: 'eskom' }
  )
  check('cross-source deduplication', cross.duplicate === true)

  const intelligence = require('../backend/services/procurementIntelligenceService')
  const selfTest = await intelligence.runSelfTest()
  check('intelligence self-test registry', selfTest.registry === true)
  check('intelligence self-test briefing', selfTest.briefingDetected === true)
  check('intelligence aggregation sync', selfTest.aggregationOk === true)

  let dashboard
  try {
    dashboard = await intelligence.getDashboardPayload()
    check('dashboard payload', Boolean(dashboard.sourceRegistry))
    check('dashboard province heatmap', Array.isArray(dashboard.provinceHeatmap))
  } catch (e) {
    check('dashboard payload', false, e.message)
  }

  const aggregation = require('../backend/services/procurement/procurementAggregationService')
  const scrape = await aggregation.runSourceScrape('eskom')
  check('scraper execution graceful', typeof scrape.ok === 'boolean' || scrape.success !== undefined)

  const workflow = require('../backend/services/workflowAutomationService')
  check(
    'workflow smart_procurement_ingestion export',
    typeof aggregation.runSmartProcurementIngestion === 'function'
  )

  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
  check('pdf-parse dependency', Boolean(pkg.dependencies['pdf-parse']))
  check('npm script procurement-intelligence:qa', Boolean(pkg.scripts['procurement-intelligence:qa']))

  const out = JSON.stringify({ selfTest, dashboard: dashboard?.sourceRegistry, scrape })
  check('no TWILIO token in output', !/TWILIO_AUTH_TOKEN=/.test(out))
  check('no openai key in output', !/sk-[a-zA-Z0-9]{10,}/.test(out))

  report.passed = report.blockers.length === 0
  report.operationalReadiness = report.passed ? 'ready' : 'blocked'
  console.log(JSON.stringify(report, null, 2))
  process.exit(report.passed ? 0 : 1)
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
