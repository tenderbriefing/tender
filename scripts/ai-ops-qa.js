#!/usr/bin/env node
/**
 * Phase 15 AI ops QA — no secrets in output.
 */
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
  const aiOps = require('../backend/services/aiOpsExecutiveService')
  const commandCenter = require('../backend/services/commandCenterService')
  const { getFirestore } = require('../backend/config/firebaseAdmin')

  const selfTest = await aiOps.runAiOpsSelfTest()
  check('AI tender summary', Boolean(selfTest.summary?.summary))
  check('opportunity scoring', selfTest.scores?.opportunityScore >= 0)
  check('dispatch optimization', Boolean(selfTest.dispatch?.optimalAgent || selfTest.dispatch?.candidates))
  check('GPS validation log', Boolean(selfTest.gpsLog?.id))
  check('payout calculation', Boolean(selfTest.payout?.id))
  check('fraud scan runs', Array.isArray(selfTest.fraud?.alerts))
  check('reconciliation', Boolean(selfTest.recon?.payments))
  check('executive dashboard extension', selfTest.dashboardLoaded)

  const cc = await commandCenter.getCommandCenterPayload()
  check('command center loads', Boolean(cc.dispatchBoard))
  check('command center aiOps', Boolean(cc.aiOps?.nationalField))

  const msg = JSON.stringify(selfTest)
  check('no twilio secret in output', !/TWILIO_AUTH_TOKEN=/.test(msg))
  check('no service account path leak', !/service-account\.json/.test(msg))

  const db = getFirestore()
  for (const col of [
    'gpsAttendanceLogs',
    'dispatchTracking',
    'fraudAlerts',
    'financePayouts',
    'aiTenderInsights',
    'operationalIncidents',
  ]) {
    try {
      await db.collection(col).limit(1).get()
      check(`Firestore ${col}`, true)
    } catch (e) {
      check(`Firestore ${col}`, false, e.message)
    }
  }

  report.passed = report.blockers.length === 0
  report.operationalReadiness = report.passed ? 'ready' : 'blocked'
  console.log(JSON.stringify(report, null, 2))
  process.exit(report.passed ? 0 : 1)
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
