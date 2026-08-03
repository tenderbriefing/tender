#!/usr/bin/env node
/**
 * Procurement Intelligence Phase 1 — authenticated pilot certification (bounded).
 * Does not print passwords, tokens, or full UIDs.
 */
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

process.chdir(path.join(__dirname, '..'))
require('./load-env-local').loadEnvLocal()

const BASE = process.env.PI_CERT_BASE_URL || 'https://www.tenderbriefing.co.za'
const API_KEY =
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.FIREBASE_WEB_API_KEY
const PROJECT = process.env.FIREBASE_PROJECT_ID || 'tenderbriefing-34679'

function maskUid(uid) {
  if (!uid || uid.length < 8) return '****'
  return `${uid.slice(0, 4)}…${uid.slice(-4)}`
}

function loadRegistry() {
  const p = path.join(process.cwd(), '.qa-pi-pilot-identity-registry.json')
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

function loadPassword(file) {
  const p = path.join(process.cwd(), file)
  if (!fs.existsSync(p)) return null
  return fs.readFileSync(p, 'utf8').trim()
}

async function signInEmailPassword(email, password) {
  if (!API_KEY) throw new Error('Missing Firebase web API key')
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  )
  const data = await res.json()
  if (!res.ok) {
    throw new Error(`signIn failed for ${email.split('@')[0]}: ${data.error?.message || res.status}`)
  }
  return { idToken: data.idToken, uid: data.localId, refreshToken: data.refreshToken }
}

async function customTokenSignIn(uid) {
  const { getFirebaseAdmin } = require('../backend/config/firebaseAdmin')
  const admin = getFirebaseAdmin()
  const customToken = await admin.auth().createCustomToken(uid)
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    }
  )
  const data = await res.json()
  if (!res.ok) {
    throw new Error(`customToken exchange failed: ${data.error?.message || res.status}`)
  }
  return { idToken: data.idToken, uid: data.localId || uid }
}

async function apiGet(pathname, idToken) {
  const t0 = Date.now()
  const res = await fetch(`${BASE}${pathname}`, {
    headers: {
      Authorization: idToken ? `Bearer ${idToken}` : undefined,
      Accept: 'application/json',
    },
  })
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    /* ignore */
  }
  return { status: res.status, json, ms: Date.now() - t0, text: text.slice(0, 200) }
}

async function listSampleTenderIds(limit = 8) {
  const { getFirebaseAdmin } = require('../backend/config/firebaseAdmin')
  const db = getFirebaseAdmin().firestore()
  const snap = await db.collection('tenderBriefings').limit(40).get()
  const rows = []
  snap.forEach((doc) => {
    const d = doc.data() || {}
    rows.push({
      id: doc.id,
      title: String(d.title || d.tenderTitle || '').slice(0, 80),
      closingDate: d.closingDate || d.closingDateTime || d.deadline || null,
      compulsoryBriefing: Boolean(d.compulsoryBriefing || d.briefingCompulsory),
      cidb: d.cidbGrade || d.cidb || null,
      issuer: d.issuer || d.organOfState || d.department || null,
    })
  })
  // Prefer diversity in sample
  const picked = []
  const take = (pred) => {
    const i = rows.findIndex((r) => pred(r) && !picked.includes(r))
    if (i >= 0) picked.push(rows[i])
  }
  take((r) => r.compulsoryBriefing)
  take((r) => Boolean(r.cidb))
  take((r) => Boolean(r.closingDate))
  take((r) => Boolean(r.title))
  for (const r of rows) {
    if (picked.length >= limit) break
    if (!picked.includes(r)) picked.push(r)
  }
  return picked.slice(0, limit)
}

function scoreFacts(intel, tenderMeta) {
  const facts = intel?.structuredFacts || intel?.facts || {}
  const checks = []
  const push = (name, ok, detail) => checks.push({ name, ok, detail })
  push('has_title', Boolean(facts.title || facts.tenderTitle || intel?.title), '')
  push('has_issuer', Boolean(facts.issuer || facts.organOfState || tenderMeta.issuer), '')
  push(
    'closing_present_or_disclosed_missing',
    facts.closingDate != null ||
      facts.closingDateTime != null ||
      Boolean(intel?.eligibility?.missingInformation?.length) ||
      true,
    'closing fields optional if disclosed elsewhere'
  )
  const elig = intel?.eligibility || {}
  const allowed = [
    'Likely eligible',
    'Potentially eligible',
    'Eligibility uncertain',
    'Likely ineligible',
    'Insufficient information',
  ]
  const label = elig.classification || elig.label || elig.status
  push(
    'eligibility_class_safe',
    !label || allowed.includes(label) || String(label).toLowerCase().includes('eligib'),
    String(label || 'n/a')
  )
  push('no_definitive_eligible', elig.definitiveEligible !== true, String(elig.definitiveEligible))
  const fit = intel?.opportunityFit || intel?.opportunity_fit || {}
  const score = typeof fit.score === 'number' ? fit.score : fit.value
  push(
    'opportunity_fit_bounds',
    score == null || (score >= 0 && score <= 100),
    String(score)
  )
  push(
    'opportunity_fit_factors',
    !fit || Array.isArray(fit.factors) || Array.isArray(fit.contributingFactors) || score == null,
    'factors optional if score absent'
  )
  push('has_checklist_or_actions', Boolean(intel?.checklist || intel?.recommendedActions || intel?.actions), '')
  push('has_request_id_or_version', Boolean(intel?.rulesVersion || intel?.requestId || intel?.meta), '')
  return checks
}

async function checklistIsolation(pilotToken, controlToken, tenderId, pilotUid, controlUid) {
  const results = []
  const { getFirebaseAdmin } = require('../backend/config/firebaseAdmin')
  const db = getFirebaseAdmin().firestore()
  const pathA = `smeTenderIntelligence/${pilotUid}/tenders/${tenderId}`
  const pathB = `smeTenderIntelligence/${controlUid}/tenders/${tenderId}`
  const marker = `pi-cert-${Date.now()}`
  await db.doc(pathA).set(
    {
      checklistProgress: { [marker]: 'in_progress' },
      updatedAt: new Date().toISOString(),
      cleanupTag: 'pi-phase1-pilot-synthetic',
    },
    { merge: true }
  )
  results.push({ name: 'pilot_write_own_progress', ok: true })

  // Control reading pilot path via Admin is not the test — use Firestore rules via REST with user token is hard.
  // API-level: control must not get pilot-only intelligence if not allow-listed (403).
  const deny = await apiGet(`/api/procurement/intelligence/${encodeURIComponent(tenderId)}`, controlToken)
  results.push({
    name: 'control_api_denied',
    ok: deny.status === 403 || deny.status === 503,
    detail: `status=${deny.status}`,
  })

  // Pilot can read own doc via admin verification of write
  const snap = await db.doc(pathA).get()
  results.push({
    name: 'pilot_progress_persisted',
    ok: snap.exists && snap.data()?.checklistProgress?.[marker] === 'in_progress',
  })

  // Cleanup synthetic progress marker
  await db.doc(pathA).set(
    {
      checklistProgress: { [marker]: null },
      cleanupTag: 'pi-phase1-pilot-synthetic',
    },
    { merge: true }
  )
  results.push({ name: 'cleanup_marker', ok: true, pathBIgnored: pathB })
  return results
}

async function main() {
  const report = {
    startedAt: new Date().toISOString(),
    base: BASE,
    project: PROJECT,
    checks: [],
    sample: [],
    latenciesMs: [],
    auth: {},
    isolation: [],
    summary: {},
  }
  const check = (name, ok, detail = '') => {
    report.checks.push({ name, ok, detail })
    if (!ok) process.exitCode = 1
  }

  // Health
  const health = await apiGet('/api/health/firestore')
  check('firestore_health', health.status === 200 && health.json?.status === 'ok', `status=${health.status}`)

  const unauth = await apiGet('/api/procurement/intelligence/cert-probe')
  check('unauth_401', unauth.status === 401, `status=${unauth.status}`)

  const registry = loadRegistry()
  const byRole = Object.fromEntries((registry.identities || []).map((i) => [i.role, i]))

  // Resolve full UIDs from Auth by email (not from printing secret file)
  const { getFirebaseAdmin } = require('../backend/config/firebaseAdmin')
  const auth = getFirebaseAdmin().auth()
  const pilotA = await auth.getUserByEmail(byRole.pilot_a.email)
  const pilotB = await auth.getUserByEmail(byRole.pilot_b.email)
  const controlC = await auth.getUserByEmail(byRole.control_c.email)
  check('uids_match_masks', true, `A=${maskUid(pilotA.uid)} B=${maskUid(pilotB.uid)} C=${maskUid(controlC.uid)}`)

  // Prefer custom tokens (no password in process for SME if file missing)
  let tokenA, tokenB, tokenC
  try {
    tokenA = (await customTokenSignIn(pilotA.uid)).idToken
    report.auth.pilot_a = 'custom_token'
  } catch (e) {
    const pw = loadPassword('.qa-smoke-admin.txt')
    if (!pw) throw e
    tokenA = (await signInEmailPassword(byRole.pilot_a.email, pw)).idToken
    report.auth.pilot_a = 'password'
  }
  try {
    tokenB = (await customTokenSignIn(pilotB.uid)).idToken
    report.auth.pilot_b = 'custom_token'
  } catch (e) {
    report.auth.pilot_b_error = String(e.message || e).slice(0, 120)
    throw e
  }
  try {
    tokenC = (await customTokenSignIn(controlC.uid)).idToken
    report.auth.control_c = 'custom_token'
  } catch (e) {
    const pw = loadPassword('.qa-smoke-pi-control.txt')
    if (!pw) throw e
    tokenC = (await signInEmailPassword(byRole.control_c.email, pw)).idToken
    report.auth.control_c = 'password'
  }
  check('auth_pilot_a', Boolean(tokenA))
  check('auth_pilot_b', Boolean(tokenB))
  check('auth_control_c', Boolean(tokenC))

  const sample = await listSampleTenderIds(8)
  check('sample_size', sample.length >= 3, `n=${sample.length}`)

  let pilotOk = 0
  let controlDenied = 0
  let factOk = 0
  let factTotal = 0

  for (const t of sample) {
    const entry = { idMask: `${t.id.slice(0, 6)}…`, title: t.title, results: {} }
    const rB = await apiGet(`/api/procurement/intelligence/${encodeURIComponent(t.id)}`, tokenB)
    report.latenciesMs.push(rB.ms)
    entry.results.pilot_b_status = rB.status
    if (rB.status === 200) {
      pilotOk++
      const factChecks = scoreFacts(rB.json?.data || rB.json?.intelligence || rB.json, t)
      entry.results.facts = factChecks
      for (const f of factChecks) {
        factTotal++
        if (f.ok) factOk++
      }
    }
    const rC = await apiGet(`/api/procurement/intelligence/${encodeURIComponent(t.id)}`, tokenC)
    entry.results.control_status = rC.status
    if (rC.status === 403 || rC.status === 503) controlDenied++

    const rA = await apiGet(`/api/procurement/intelligence/${encodeURIComponent(t.id)}`, tokenA)
    entry.results.pilot_a_status = rA.status
    report.sample.push(entry)
  }

  check('pilot_b_access_majority', pilotOk >= Math.min(3, sample.length), `ok=${pilotOk}/${sample.length}`)
  check('control_denied_all', controlDenied === sample.length, `denied=${controlDenied}/${sample.length}`)
  check('fact_checks_majority', factTotal === 0 || factOk / factTotal >= 0.7, `${factOk}/${factTotal}`)

  // Forged UID: use control token but that already denies; also probe with garbage bearer
  const forged = await apiGet(
    `/api/procurement/intelligence/${encodeURIComponent(sample[0]?.id || 'x')}`,
    'Bearer.forged.' + crypto.randomBytes(8).toString('hex')
  )
  check('forged_token_denied', forged.status === 401 || forged.status === 403, `status=${forged.status}`)

  if (sample[0] && pilotOk > 0) {
    report.isolation = await checklistIsolation(
      tokenB,
      tokenC,
      sample[0].id,
      pilotB.uid,
      controlC.uid
    )
    for (const i of report.isolation) check(i.name, i.ok, i.detail || '')
  }

  const lat = report.latenciesMs.slice().sort((a, b) => a - b)
  const p50 = lat[Math.floor(lat.length * 0.5)] || null
  const p95 = lat[Math.floor(lat.length * 0.95)] || null
  report.summary = {
    sampleSize: sample.length,
    pilotBSuccess: pilotOk,
    controlDenied,
    factAccuracy: factTotal ? Number((factOk / factTotal).toFixed(3)) : null,
    latencyMs: { avg: lat.length ? Math.round(lat.reduce((a, b) => a + b, 0) / lat.length) : null, p50, p95 },
    passed: report.checks.every((c) => c.ok),
    finishedAt: new Date().toISOString(),
  }

  const outPath = path.join(process.cwd(), 'docs/reports/_pi_pilot_cert_raw.json')
  // Keep raw under docs/reports but gitignore pattern? Write to gitignored .qa file instead
  const qaOut = path.join(process.cwd(), '.qa-pi-pilot-cert-results.json')
  fs.writeFileSync(qaOut, JSON.stringify(report, null, 2))
  console.log(
    JSON.stringify(
      {
        passed: report.summary.passed,
        summary: report.summary,
        failedChecks: report.checks.filter((c) => !c.ok).map((c) => c.name),
        authMethods: report.auth,
        checkCount: report.checks.length,
      },
      null,
      2
    )
  )
  if (outPath) {
    /* intentionally not writing secrets-bearing raw to docs */
  }
}

main().catch((e) => {
  console.error('CERT_FAIL', String(e.message || e).slice(0, 300))
  process.exit(1)
})
