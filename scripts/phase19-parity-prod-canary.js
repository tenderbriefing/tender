#!/usr/bin/env node
/**
 * Phase 19 production canary — parity summary, classify, SME matching, sync probe.
 *
 * Usage:
 *   PHASE19_CANARY=1 node scripts/phase19-parity-prod-canary.js
 */
const { execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')

process.chdir(path.join(__dirname, '..'))
try {
  require('./load-env-local').loadEnvLocal()
} catch {
  /* optional */
}

if (process.env.PHASE19_CANARY !== '1') {
  console.error('Set PHASE19_CANARY=1 to run this production canary.')
  process.exit(1)
}

process.env.GOOGLE_APPLICATION_CREDENTIALS =
  process.env.GOOGLE_APPLICATION_CREDENTIALS || path.resolve('service-account.json')
process.env.STORAGE_ADAPTER = 'firestore'
process.env.FIREBASE_PROJECT_ID =
  process.env.FIREBASE_PROJECT_ID || 'tenderbriefing-34679'

const PROD_BASE =
  process.env.PROD_BASE_URL || 'https://tenderbriefing-xzgs5uw5ta-bq.a.run.app'
const WWW_BASE = process.env.PHASE19_CERT_BASE || 'https://www.tenderbriefing.co.za'
const PROJECT = process.env.FIREBASE_PROJECT_ID
const ADMIN_EMAIL = process.env.FOUNDER_ADMIN_EMAIL || 'info@tenderbriefing.co.za'
const LOOKBACK = Number(process.env.PHASE19_LOOKBACK_DAYS || 30)

function getSecret(name) {
  return execFileSync(
    'gcloud',
    ['secrets', 'versions', 'access', 'latest', `--secret=${name}`, `--project=${PROJECT}`],
    { encoding: 'utf8' }
  ).trim()
}

async function getAdminIdToken() {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  const { getFirebaseAdmin } = require('../backend/config/firebaseAdmin')
  const admin = getFirebaseAdmin()
  const user = await admin.auth().getUserByEmail(ADMIN_EMAIL)
  const customToken = await admin.auth().createCustomToken(user.uid)
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    }
  )
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || 'admin auth failed')
  return data.idToken
}

async function postAdmin(idToken, body) {
  const res = await fetch(`${WWW_BASE}/api/admin/etenders-mirror`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  return { status: res.status, json }
}

async function getAdmin(idToken, query) {
  const res = await fetch(`${WWW_BASE}/api/admin/etenders-mirror?${query}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  })
  const json = await res.json().catch(() => ({}))
  return { status: res.status, json }
}

async function main() {
  const startedAt = new Date().toISOString()
  const idToken = await getAdminIdToken()

  console.log('[phase19] days view…')
  const days = await getAdmin(idToken, `view=days&lookbackDays=${LOOKBACK}`)
  console.log('[phase19] classify briefings…')
  const classify = await postAdmin(idToken, {
    action: 'classify_briefings',
    limit: 300,
  })
  console.log('[phase19] run parity (5 days)…')
  const parity = await postAdmin(idToken, {
    action: 'run_parity',
    lookbackDays: LOOKBACK,
    maxDays: 5,
  })
  console.log('[phase19] exceptions…')
  const exceptions = await getAdmin(idToken, 'view=exceptions&limit=100')

  const smeRes = await fetch(`${WWW_BASE}/api/admin/sme-connect`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ action: 'run_matching', limit: 30 }),
  })
  const smeJson = await smeRes.json().catch(() => ({}))

  let syncProbe = null
  try {
    const secret = getSecret('tenderbriefing-sync-secret')
    const res = await fetch(`${PROD_BASE}/api/sync/ocds-parity-daily`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-sync-secret': secret,
      },
      body: JSON.stringify({
        lookbackDays: LOOKBACK,
        maxDaysPerTick: 1,
        maxRecoveryDays: 1,
        maxReconcileDays: 1,
      }),
    })
    const json = await res.json().catch(() => ({}))
    syncProbe = { status: res.status, success: json.success === true, error: json.error || null }
  } catch (err) {
    syncProbe = { status: 0, error: String(err.message || err) }
  }

  const summary = days.json?.data?.summary || {}
  const paritySummary = days.json?.data?.paritySummary || parity.json?.data?.summary || {}
  const classCounts = classify.json?.data?.counts || {}
  const smeCandidates = smeJson?.data?.candidatesCreated ?? null

  const websiteUniverseComplete =
    Number(paritySummary.websiteDiscoverableKnownDays || 0) ===
      Number(paritySummary.totalCalendarDays || summary.totalCalendarDays || 0) &&
    Number(paritySummary.totalWebsiteDiscoverable || 0) > 0

  let verdict = 'PARTIAL PARITY'
  if (Number(summary.totalMissingLocally || 0) > 0) verdict = 'FAIL'
  else if (websiteUniverseComplete && Number(paritySummary.totalWebsiteOnly || 0) === 0) {
    verdict = 'FULL WEBSITE PARITY PASS'
  } else if (
    Number(summary.totalMissingLocally || 0) === 0 &&
    Number(summary.successfulReleaseApiDays || 0) > 0
  ) {
    verdict = 'REACHABLE-SOURCE PARITY PASS'
  }

  const out = {
    generatedAt: new Date().toISOString(),
    startedAt,
    productionBase: PROD_BASE,
    wwwBase: WWW_BASE,
    lookbackDays: LOOKBACK,
    daysView: { httpStatus: days.status, summary, paritySummary },
    classify: { httpStatus: classify.status, data: classify.json?.data || classify.json },
    parityRun: { httpStatus: parity.status, success: parity.json?.success },
    exceptions: {
      httpStatus: exceptions.status,
      openCount: exceptions.json?.data?.summary?.openCount ?? null,
    },
    smeMatching: { httpStatus: smeRes.status, data: smeJson?.data || smeJson },
    syncProbe,
    verdict,
  }

  const outPath = path.join(process.cwd(), 'tmp-phase19-parity-prod-canary.json')
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2))
  console.log(
    JSON.stringify(
      {
        verdict,
        dateFrom: summary.dateFrom,
        dateTo: summary.dateTo,
        successfulReleaseApiDays: summary.successfulReleaseApiDays,
        unresolvedUnavailableDays: summary.unresolvedUnavailableDays,
        missingLocallyCount: summary.totalMissingLocally,
        confirmedCompulsory: classCounts.CONFIRMED_COMPULSORY,
        likelyCompulsory: classCounts.LIKELY_COMPULSORY,
        smeCandidates,
        syncProbe,
        outPath,
      },
      null,
      2
    )
  )
}

main().catch((err) => {
  console.error('[phase19] failed:', err)
  process.exit(1)
})
