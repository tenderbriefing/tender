#!/usr/bin/env node
/**
 * Calendar intelligence QA — conflicts, workload, travel risk.
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

async function main() {
  check('calendarIntelligenceService exists', fs.existsSync('backend/services/calendarIntelligenceService.js'))

  const rules = fs.readFileSync('firestore.rules', 'utf8')
  check('calendarIntelligenceInsights rules', rules.includes('calendarIntelligenceInsights'))

  const calendarIntel = require('../backend/services/calendarIntelligenceService')
  const insight = await calendarIntel.analyzeCalendar()
  check('workload score generated', typeof insight.procurementWorkloadScore === 'number')
  check('travel risk score', typeof insight.travelRiskScore === 'number')
  check('briefing pressure', Boolean(insight.briefingPressureIndicators))

  const out = JSON.stringify(insight)
  check('no secrets in output', !/sk-[a-zA-Z0-9]{20,}/.test(out))

  report.passed = report.blockers.length === 0
  console.log(JSON.stringify(report, null, 2))
  process.exit(report.passed ? 0 : 1)
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
