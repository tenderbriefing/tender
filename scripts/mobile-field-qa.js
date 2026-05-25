#!/usr/bin/env node
/**
 * Phase 16 — Agent field PWA QA (no secrets in output).
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
  const pages = [
    'app/agent/mobile/layout.tsx',
    'app/agent/mobile/login/page.tsx',
    'app/agent/mobile/dispatch/page.tsx',
    'app/agent/mobile/briefing/[requestId]/page.tsx',
    'app/agent/mobile/earnings/page.tsx',
    'app/agent/mobile/performance/page.tsx',
    'public/agent-field-manifest.webmanifest',
    'public/sw-agent-field.js',
    'lib/mobile/mobileApi.ts',
    'lib/mobile/offlineStore.ts',
    'lib/mobile/syncService.ts',
    'backend/services/mobile/mobileFieldService.js',
  ]
  for (const p of pages) check(`file ${p}`, fileExists(p))

  const apiRoutes = [
    'app/api/mobile/v1/dispatch/route.ts',
    'app/api/mobile/v1/briefing/[requestId]/route.ts',
    'app/api/mobile/v1/check-in/route.ts',
    'app/api/mobile/v1/check-out/route.ts',
    'app/api/mobile/v1/earnings/route.ts',
    'app/api/mobile/v1/performance/route.ts',
    'app/api/mobile/v1/telemetry/route.ts',
    'app/api/mobile/v1/location/route.ts',
    'app/api/mobile/v1/sync/route.ts',
    'app/api/mobile/v1/session/route.ts',
    'app/api/mobile/v1/media/route.ts',
  ]
  for (const r of apiRoutes) check(`api ${r}`, fileExists(r))

  const rules = fs.readFileSync('firestore.rules', 'utf8')
  for (const col of ['mobileSessions', 'mobileSyncQueue', 'mobileTelemetry', 'agentLocationPings']) {
    check(`firestore rules ${col}`, rules.includes(`match /${col}/`))
  }

  const field = require('../backend/services/mobile/mobileFieldService')
  check('getMobileDispatchBoard', typeof field.getMobileDispatchBoard === 'function')
  check('getLiveFieldMap', typeof field.getLiveFieldMap === 'function')
  check('processSyncQueue', typeof field.processSyncQueue === 'function')

  const { getFirestore } = require('../backend/config/firebaseAdmin')
  const db = getFirestore()
  for (const col of ['mobileSessions', 'mobileSyncQueue', 'mobileTelemetry', 'agentLocationPings']) {
    try {
      await db.collection(col).limit(1).get()
      check(`Firestore read ${col}`, true)
    } catch (e) {
      check(`Firestore read ${col}`, false, e.message)
    }
  }

  const envSample = fs.readFileSync('env.example', 'utf8')
  const gitignore = fs.readFileSync('.gitignore', 'utf8')
  check('.env.local gitignored', gitignore.includes('.env*.local') || gitignore.includes('.env.local'))
  check('service-account.json gitignored', gitignore.includes('service-account.json'))
  check('env.example has no raw secrets', !/sk_live_|AIza[0-9A-Za-z_-]{20,}/.test(envSample))

  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
  check('npm script mobile-field-qa', Boolean(pkg.scripts['mobile-field-qa']))

  report.passed = report.blockers.length === 0
  report.operationalReadiness = report.passed ? 'ready' : 'blocked'
  console.log(JSON.stringify(report, null, 2))
  process.exit(report.passed ? 0 : 1)
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
