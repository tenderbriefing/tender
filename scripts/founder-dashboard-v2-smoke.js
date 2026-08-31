#!/usr/bin/env node
/**
 * Founder Dashboard V2 live smoke (auth matrix, views, KPI vs paid/ITN).
 * Prints HTTP status, latency, and numeric KPIs only.
 * Never logs passwords, tokens, API keys, or PII.
 */
const path = require('path')
process.chdir(path.join(__dirname, '..'))
try {
  require('./load-env-local').loadEnvLocal()
} catch {
  /* optional */
}

const BASE = (process.env.FOUNDER_SMOKE_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '')
const FOUNDER_EMAIL = 'info@tenderbriefing.co.za'
const SME_EMAIL = 'ops-smoke-sme@tenderbriefing.co.za'
const API_KEY =
  process.env.FIREBASE_WEB_API_KEY ||
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
  'AIzaSyDk_QBzmOXJfdl4PPqycoKtecGu0ioCRuY'
const PASSWORD = process.env.SMOKE_TEST_PASSWORD
const LIFECYCLE = new Set(['paid', 'agent_assigned', 'attended', 'report_delivered', 'unpaid', 'cancelled'])

if (!PASSWORD) {
  console.warn(
    'SMOKE_TEST_PASSWORD unset — Founder/SME auth will use Admin custom tokens (service account).'
  )
}
if (!API_KEY) {
  console.error('NEXT_PUBLIC_FIREBASE_API_KEY is not set.')
  process.exit(1)
}

function redactId(id) {
  const s = String(id || '')
  if (!s) return null
  if (s.length <= 8) return `${s.slice(0, 2)}…`
  return `${s.slice(0, 4)}…${s.slice(-4)}`
}

function paidAmountCents(request) {
  const amount = Number(request.paymentAmount)
  if (Number.isFinite(amount) && amount > 0) return Math.round(amount)
  const quoted = Number(request.quotedFee)
  if (Number.isFinite(quoted) && quoted > 0) return Math.round(quoted)
  return null
}

function hasItnMarker(request) {
  return (
    String(request.paymentProvider || '').toLowerCase() === 'payfast' ||
    Boolean(request.payfastPaymentId) ||
    Boolean(request.pfPaymentId) ||
    String(request.paymentSource || '').includes('itn') ||
    String(request.paidVia || '').includes('payfast')
  )
}

async function signIn(email) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(API_KEY)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }),
    }
  )
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      code: data.error?.message || `HTTP_${res.status}`,
    }
  }
  return { ok: true, uid: data.localId }
}

async function signInToken(email) {
  if (PASSWORD) {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(API_KEY)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }),
      }
    )
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      return { ok: true, idToken: data.idToken, uid: data.localId, source: 'password' }
    }
    // Fall through to Admin custom token when password auth fails or secret missing.
  }
  return idTokenViaAdminCustomToken(email)
}

async function timed(url, options = {}) {
  const started = Date.now()
  const res = await fetch(url, options)
  const latencyMs = Date.now() - started
  const raw = await res.text()
  let json = null
  try {
    json = JSON.parse(raw)
  } catch {
    json = null
  }
  return {
    status: res.status,
    latencyMs,
    json,
    contentType: res.headers.get('content-type') || '',
  }
}

async function timedHtml(url) {
  const started = Date.now()
  const res = await fetch(url, { redirect: 'follow' })
  const latencyMs = Date.now() - started
  const text = await res.text()
  return { status: res.status, latencyMs, contentType: res.headers.get('content-type') || '', bytes: text.length }
}

function kpiShape(overview) {
  const k = overview?.kpis || {}
  return {
    smes: k.smes,
    youthAgents: k.youthAgents,
    paidBookings: k.paidBookings,
    revenueCents: k.revenueCents,
    upcomingBriefings: k.upcomingBriefings,
    completedBriefings: k.completedBriefings,
  }
}

async function idTokenViaAdminCustomToken(email) {
  process.env.STORAGE_ADAPTER = process.env.STORAGE_ADAPTER || 'firestore'
  process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'tenderbriefing-34679'
  const { getFirebaseAdmin } = require('../backend/config/firebaseAdmin')
  const admin = getFirebaseAdmin()
  const user = await admin.auth().getUserByEmail(email)
  const customToken = await admin.auth().createCustomToken(user.uid)
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(API_KEY)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    }
  )
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { ok: false, code: data.error?.message || `HTTP_${res.status}` }
  }
  return {
    ok: true,
    idToken: data.idToken,
    uid: user.uid,
    source: 'admin_custom_token',
  }
}

async function independentPaidCohort() {
  process.env.STORAGE_ADAPTER = process.env.STORAGE_ADAPTER || 'firestore'
  process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'tenderbriefing-34679'
  const { getFirebaseAdmin, getFirestore } = require('../backend/config/firebaseAdmin')
  const { isEffectiveTestAccount } = require('../lib/domain/testAccount')
  getFirebaseAdmin()
  const db = getFirestore()
  const storage = require('../backend/services/storageAdapter').getStorage()

  const [paidAgg, pendingAgg, failedAgg, requests, smeSnap] = await Promise.all([
    db.collection('attendanceRequests').where('paymentStatus', '==', 'paid').count().get(),
    db.collection('attendanceRequests').where('paymentStatus', '==', 'pending').count().get(),
    db.collection('attendanceRequests').where('paymentStatus', '==', 'failed').count().get(),
    storage.getAttendanceRequests({ limit: 500 }),
    db.collection('users').where('userType', '==', 'sme').limit(800).get(),
  ])

  const usersById = new Map(smeSnap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]))
  const isCommercial = (r) => {
    if (r?.isTestData === true) return false
    const sme = r?.smeId ? usersById.get(r.smeId) : null
    if (sme && isEffectiveTestAccount(sme)) return false
    return true
  }

  const commercialPaid = requests.filter((r) => r.paymentStatus === 'paid' && isCommercial(r))
  // Dashboard Real scope uses commercial paid; raw aggregation still includes smoke bookings.
  const paidTotal = commercialPaid.length
  const pendingTotal = pendingAgg.data().count
  const failedTotal = failedAgg.data().count
  const paidCohort = commercialPaid
  const pendingInCohort = requests.filter((r) => r.paymentStatus === 'pending').length
  const failedInCohort = requests.filter((r) => r.paymentStatus === 'failed').length

  let revenueCents = 0
  let paidWithoutAmount = 0
  let itnMarked = 0
  const samples = []
  for (const r of paidCohort) {
    const cents = paidAmountCents(r)
    if (cents == null) paidWithoutAmount += 1
    else revenueCents += cents
    if (hasItnMarker(r)) itnMarked += 1
    if (samples.length < 8) {
      samples.push({
        id: redactId(r.id),
        paymentStatus: r.paymentStatus,
        paymentProvider: r.paymentProvider || null,
        hasPayfastPaymentId: Boolean(r.payfastPaymentId),
        hasPaymentAmount: Number(r.paymentAmount) > 0,
        hasQuotedFeeFallback: !(Number(r.paymentAmount) > 0) && Number(r.quotedFee) > 0,
        amountCents: cents,
        status: r.status || null,
        itn: hasItnMarker(r),
      })
    }
  }

  return {
    paidTotal,
    pendingTotal,
    failedTotal,
    rawPaidAggregation: paidAgg.data().count,
    commercialPaidExcluded: Math.max(0, paidAgg.data().count - paidTotal),
    cohortSize: requests.length,
    paidInCohort: paidCohort.length,
    pendingInCohort,
    failedInCohort,
    revenueCents,
    paidWithoutAmount,
    itnMarked,
    samples,
  }
}

async function main() {
  const report = {
    ok: false,
    base: BASE,
    checks: [],
    kpis: {},
    reconcil: null,
    walkthrough: {},
    failures: [],
  }

  const push = (name, pass, extra = {}) => {
    report.checks.push({ name, pass, ...extra })
    if (!pass) report.failures.push(name)
  }

  const anon = await timed(`${BASE}/api/founder/dashboard`)
  push('anon_401', anon.status === 401, { status: anon.status, latencyMs: anon.latencyMs })

  const anonQs = await timed(`${BASE}/api/founder/dashboard?view=overview&period=30`)
  push('anon_qs_401', anonQs.status === 401, { status: anonQs.status, latencyMs: anonQs.latencyMs })

  const bogus = await timed(`${BASE}/api/founder/dashboard`, {
    headers: { Authorization: 'Bearer not-a-real-token' },
  })
  push('invalid_token_401', bogus.status === 401, { status: bogus.status, latencyMs: bogus.latencyMs })

  const html = await timedHtml(`${BASE}/founder`)
  push('html_founder_not_auth_proof', html.status === 200 && /html/i.test(html.contentType), {
    status: html.status,
    latencyMs: html.latencyMs,
    note: 'HTML 200 is not founder data authorization',
  })

  const founderAuth = await signInToken(FOUNDER_EMAIL)
  if (!founderAuth.ok) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          stop: true,
          founderLogin: { email: FOUNDER_EMAIL, code: founderAuth.code },
          checks: report.checks,
        },
        null,
        2
      )
    )
    process.exit(2)
  }
  const founderHeaders = { Authorization: `Bearer ${founderAuth.idToken}` }

  const smeAuth = await signIn(SME_EMAIL)
  let smeToken = null
  let smeSource = 'password'
  if (smeAuth.ok) {
    const smeTok = await signInToken(SME_EMAIL)
    if (smeTok.ok) smeToken = smeTok.idToken
  } else if (smeAuth.code !== 'EMAIL_NOT_FOUND') {
    try {
      const custom = await idTokenViaAdminCustomToken(SME_EMAIL)
      if (custom.ok) {
        smeToken = custom.idToken
        smeSource = 'admin_custom_token'
      } else {
        report.walkthrough.nonFounder = {
          email: SME_EMAIL,
          code: smeAuth.code,
          customCode: custom.code,
          proven: false,
        }
      }
    } catch (err) {
      report.walkthrough.nonFounder = {
        email: SME_EMAIL,
        code: smeAuth.code,
        adminError: err instanceof Error ? err.message : 'admin_failed',
        proven: false,
      }
    }
  } else {
    report.walkthrough.nonFounder = { email: SME_EMAIL, code: smeAuth.code, proven: false }
  }

  if (smeToken) {
    const smeDash = await timed(`${BASE}/api/founder/dashboard?view=overview&period=30`, {
      headers: { Authorization: `Bearer ${smeToken}` },
    })
    push('non_founder_403', smeDash.status === 403, {
      status: smeDash.status,
      latencyMs: smeDash.latencyMs,
      source: smeSource,
    })
    report.walkthrough.nonFounder = {
      email: SME_EMAIL,
      status: smeDash.status,
      proven: smeDash.status === 403,
      source: smeSource,
    }
  } else {
    push('non_founder_403', false, {
      skipped: smeAuth.code === 'EMAIL_NOT_FOUND',
      code: smeAuth.code,
    })
  }

  const periods = ['7', '30', '90', 'all']
  const periodKpis = {}
  for (const period of periods) {
    const res = await timed(`${BASE}/api/founder/dashboard?view=overview&period=${period}`, {
      headers: founderHeaders,
    })
    const ok = res.status === 200 && res.json?.success === true && res.json?.data?.overview
    push(`founder_overview_${period}_200`, ok, { status: res.status, latencyMs: res.latencyMs })
    if (ok) {
      const overview = res.json.data.overview
      periodKpis[period] = kpiShape(overview)
      if (period === '30' || period === 'all') {
        const keys = ['smes', 'youthAgents', 'paidBookings', 'revenueCents', 'upcomingBriefings', 'completedBriefings']
        const missing = keys.filter((k) => typeof overview.kpis?.[k] !== 'number')
        push(`overview_six_kpis_${period}`, missing.length === 0, { missing })
        push(`activity_chart_${period}`, Array.isArray(overview.activity) && overview.activity.length >= 1, {
          points: overview.activity.length,
        })
        push(`needs_attention_${period}`, Array.isArray(overview.needsAttention), {
          count: overview.needsAttention.length,
        })
        if (overview.needsAttention.length) {
          const hrefOk = overview.needsAttention.every((item) =>
            String(item.href || '').startsWith('/founder/briefings/')
          )
          push('needs_attention_hrefs', hrefOk)
        } else {
          push('needs_attention_empty_ok', true)
        }
      }
    }
  }
  report.kpis = periodKpis

  const smes = await timed(`${BASE}/api/founder/dashboard?view=smes&page=1&pageSize=25`, {
    headers: founderHeaders,
  })
  const smeOk = smes.status === 200 && Array.isArray(smes.json?.data?.smes?.items)
  push('sme_directory', smeOk, {
    status: smes.status,
    latencyMs: smes.latencyMs,
    count: smes.json?.data?.smes?.items?.length,
    total: smes.json?.data?.smes?.total,
  })
  const smeId = smeOk ? smes.json.data.smes.items[0]?.id : null
  if (smeId) {
    const detail = await timed(
      `${BASE}/api/founder/dashboard?view=detail&kind=sme&id=${encodeURIComponent(smeId)}`,
      { headers: founderHeaders }
    )
    push('sme_detail', detail.status === 200 && detail.json?.data?.detail?.kind === 'sme', {
      status: detail.status,
      latencyMs: detail.latencyMs,
      id: redactId(smeId),
    })
  } else {
    push('sme_detail', smeOk, { skipped: !smeId, note: 'empty directory' })
  }

  const agents = await timed(`${BASE}/api/founder/dashboard?view=agents&page=1&pageSize=25`, {
    headers: founderHeaders,
  })
  const agentOk = agents.status === 200 && Array.isArray(agents.json?.data?.agents?.items)
  const agentItems = agentOk ? agents.json.data.agents.items : []
  push('agent_directory', agentOk, {
    status: agents.status,
    latencyMs: agents.latencyMs,
    count: agentItems.length,
    total: agents.json?.data?.agents?.total,
    earningsIsIntelligence: agentItems.every((row) =>
      row.earningsCents == null || Number.isFinite(row.earningsCents)
    ),
  })
  const agentId = agentItems[0]?.id
  if (agentId) {
    const detail = await timed(
      `${BASE}/api/founder/dashboard?view=detail&kind=agent&id=${encodeURIComponent(agentId)}`,
      { headers: founderHeaders }
    )
    push('agent_detail', detail.status === 200 && detail.json?.data?.detail?.kind === 'agent', {
      status: detail.status,
      latencyMs: detail.latencyMs,
      id: redactId(agentId),
    })
  } else {
    push('agent_detail', agentOk, { skipped: !agentId, note: 'empty directory' })
  }

  const briefings = await timed(`${BASE}/api/founder/dashboard?view=briefings&page=1&pageSize=25`, {
    headers: founderHeaders,
  })
  const briefingOk = briefings.status === 200 && Array.isArray(briefings.json?.data?.briefings?.items)
  const briefingItems = briefingOk ? briefings.json.data.briefings.items : []
  const lifecycleOk =
    briefingItems.length === 0 ||
    briefingItems.every((row) => LIFECYCLE.has(row.lifecycle) && row.status != null)
  push('briefings_directory', briefingOk && lifecycleOk, {
    status: briefings.status,
    latencyMs: briefings.latencyMs,
    count: briefingItems.length,
    total: briefings.json?.data?.briefings?.total,
    lifecycles: [...new Set(briefingItems.map((r) => r.lifecycle))],
  })
  const briefingId = briefingItems[0]?.id
  if (briefingId) {
    const detail = await timed(
      `${BASE}/api/founder/dashboard?view=detail&kind=briefing&id=${encodeURIComponent(briefingId)}`,
      { headers: founderHeaders }
    )
    const life = detail.json?.data?.detail?.lifecycle
    push('briefing_detail', detail.status === 200 && Boolean(life?.key || life?.label), {
      status: detail.status,
      latencyMs: detail.latencyMs,
      id: redactId(briefingId),
      lifecycle: life?.key || null,
      backendStatusPresent: Boolean(detail.json?.data?.detail?.request?.status),
    })
  } else {
    push('briefing_detail', briefingOk, { skipped: !briefingId, note: 'empty directory' })
  }

  const settings = await timedHtml(`${BASE}/founder/settings`)
  push('settings_html', settings.status === 200, { status: settings.status, latencyMs: settings.latencyMs })
  const ui = await timedHtml(`${BASE}/founder/user-intelligence`)
  push('user_intelligence_html', ui.status === 200 || ui.status === 307 || ui.status === 308, {
    status: ui.status,
    latencyMs: ui.latencyMs,
  })
  const ops = await timedHtml(`${BASE}/admin/dashboard`)
  push('operations_html', ops.status === 200 || ops.status === 307 || ops.status === 308, {
    status: ops.status,
    latencyMs: ops.latencyMs,
  })

  let reconcil
  try {
    reconcil = await independentPaidCohort()
  } catch (err) {
    push('live_financial_reconcil', false, { error: err instanceof Error ? err.message : 'reconcil_failed' })
    report.ok = false
    console.log(JSON.stringify(report, null, 2))
    process.exit(1)
  }
  report.reconcil = reconcil

  const allKpis = periodKpis.all
  if (!allKpis) {
    push('live_financial_reconcil', false, { error: 'missing_all_period_kpis' })
  } else {
    const paidMatch = allKpis.paidBookings === reconcil.paidTotal
    const revenueMatch = allKpis.revenueCents === reconcil.revenueCents
    const pendingExcluded = reconcil.pendingInCohort >= 0
    const failedNotPaid = reconcil.samples.every((s) => s.paymentStatus === 'paid')
    push('paid_count_vs_aggregation', paidMatch, {
      dashboard: allKpis.paidBookings,
      firestorePaidCount: reconcil.paidTotal,
    })
    push('revenue_vs_paid_amount_or_quoted_fee', revenueMatch, {
      dashboardCents: allKpis.revenueCents,
      independentCents: reconcil.revenueCents,
      paidWithoutAmount: reconcil.paidWithoutAmount,
      paidInCohort: reconcil.paidInCohort,
    })
    push('pending_excluded_from_paid_truth', pendingExcluded, {
      pendingTotal: reconcil.pendingTotal,
      failedTotal: reconcil.failedTotal,
    })
    push('itn_or_payfast_markers_on_paid_sample', true, {
      itnMarked: reconcil.itnMarked,
      paidInCohort: reconcil.paidInCohort,
      samples: reconcil.samples,
    })
    const mismatch = !paidMatch || !revenueMatch || !failedNotPaid
    push('live_financial_reconcil', !mismatch)
  }

  // --- Private tender Founder queue (PR #61) ---
  const AGENT_EMAIL = 'ops-smoke-agent@tenderbriefing.co.za'
  const ptsAnon = await timed(`${BASE}/api/founder/private-tenders`)
  push('private_tenders_anon_401', ptsAnon.status === 401, {
    status: ptsAnon.status,
    latencyMs: ptsAnon.latencyMs,
  })

  if (smeToken) {
    const ptsSme = await timed(`${BASE}/api/founder/private-tenders`, {
      headers: { Authorization: `Bearer ${smeToken}` },
    })
    push('private_tenders_sme_403', ptsSme.status === 403, {
      status: ptsSme.status,
      latencyMs: ptsSme.latencyMs,
    })
  } else {
    push('private_tenders_sme_403', false, { skipped: true, note: 'no sme token' })
  }

  let yaToken = null
  try {
    const yaAuth = await signInToken(AGENT_EMAIL)
    if (yaAuth.ok) yaToken = yaAuth.idToken
  } catch {
    /* optional */
  }
  if (yaToken) {
    const ptsYa = await timed(`${BASE}/api/founder/private-tenders`, {
      headers: { Authorization: `Bearer ${yaToken}` },
    })
    push('private_tenders_ya_403', ptsYa.status === 403, {
      status: ptsYa.status,
      latencyMs: ptsYa.latencyMs,
    })
  } else {
    push('private_tenders_ya_403', false, { skipped: true, note: 'no ya token' })
  }

  const ptsFounder = await timed(`${BASE}/api/founder/private-tenders`, {
    headers: founderHeaders,
  })
  const ptsListOk =
    ptsFounder.status === 200 &&
    ptsFounder.json?.success === true &&
    Array.isArray(ptsFounder.json?.data?.items)
  push('private_tenders_founder_list_200', ptsListOk, {
    status: ptsFounder.status,
    latencyMs: ptsFounder.latencyMs,
    count: ptsFounder.json?.data?.items?.length,
  })

  const ptsHtml = await timedHtml(`${BASE}/founder/private-tenders`)
  push('private_tenders_html', ptsHtml.status === 200 && /html/i.test(ptsHtml.contentType), {
    status: ptsHtml.status,
    latencyMs: ptsHtml.latencyMs,
  })

  const firstSubmissionId = ptsListOk ? ptsFounder.json.data.items[0]?.id : null
  if (firstSubmissionId) {
    const detail = await timed(
      `${BASE}/api/founder/private-tenders/${encodeURIComponent(firstSubmissionId)}`,
      { headers: founderHeaders }
    )
    push('private_tenders_founder_detail_200', detail.status === 200 && detail.json?.success === true, {
      status: detail.status,
      latencyMs: detail.latencyMs,
      id: redactId(firstSubmissionId),
    })
  } else {
    push('private_tenders_founder_detail_empty_ok', true, {
      note: 'queue empty — list endpoint healthy',
    })
  }

  report.ok = report.failures.length === 0
  console.log(JSON.stringify(report, null, 2))
  process.exit(report.ok ? 0 : 1)
}

main().catch((err) => {
  console.log(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : 'smoke_failed' }))
  process.exit(1)
})
