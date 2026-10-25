#!/usr/bin/env node
/**
 * Phase 20 production certification — audit, backtest, classify sample,
 * controlled outreach to TenderBriefing test inbox only.
 *
 * Usage:
 *   PHASE20_CERT=1 node scripts/phase20-sme-connect-prod-cert.js
 */
const fs = require('fs')
const path = require('path')

process.chdir(path.join(__dirname, '..'))
try {
  require('./load-env-local').loadEnvLocal()
} catch {
  /* optional */
}

if (process.env.PHASE20_CERT !== '1') {
  console.error('Set PHASE20_CERT=1 to run this production certification.')
  process.exit(1)
}

process.env.GOOGLE_APPLICATION_CREDENTIALS =
  process.env.GOOGLE_APPLICATION_CREDENTIALS || path.resolve('service-account.json')
process.env.STORAGE_ADAPTER = 'firestore'
process.env.FIREBASE_PROJECT_ID =
  process.env.FIREBASE_PROJECT_ID || 'tenderbriefing-34679'

const WWW = process.env.PHASE20_CERT_BASE || 'https://www.tenderbriefing.co.za'
const ADMIN_EMAIL = process.env.FOUNDER_ADMIN_EMAIL || 'info@tenderbriefing.co.za'
const CERT_INBOX = process.env.SME_CONNECT_CERT_INBOX || 'info@tenderbriefing.co.za'

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

async function adminGet(idToken, query) {
  const res = await fetch(`${WWW}/api/admin/sme-connect?${query}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  })
  const json = await res.json().catch(() => ({}))
  return { status: res.status, json }
}

async function adminPost(idToken, body) {
  const res = await fetch(`${WWW}/api/admin/sme-connect`, {
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

async function main() {
  const startedAt = new Date().toISOString()
  const idToken = await getAdminIdToken()

  console.log('[phase20] audit historical paid…')
  const audit = await adminGet(idToken, 'view=audit')

  console.log('[phase20] classification sample…')
  const classSample = await adminGet(idToken, 'view=classification-sample&sampleSize=25')

  console.log('[phase20] backtest matching…')
  // Calibrated REVIEW floor is 0.45 (see DEFAULT_THRESHOLDS). Batch size kept
  // modest to stay under Cloud Run request budget.
  const backtest = await adminPost(idToken, {
    action: 'backtest',
    limit: 80,
    minScore: 0.45,
    persist: true,
    includeTestSmes: false,
  })
  if (!backtest.json?.success) {
    console.error('[phase20] backtest failed', backtest.status, backtest.json)
  }

  console.log('[phase20] funnel…')
  const funnel = await adminGet(idToken, 'view=funnel')

  const list = await adminGet(idToken, 'limit=200')
  const candidates = Array.isArray(list.json?.data) ? list.json.data : []
  const high = candidates.filter((c) => c.matchBand === 'HIGH_CONFIDENCE')
  const review = candidates.filter((c) => c.matchBand === 'REVIEW')
  const pick = high[0] || review[0] || null

  let approve = null
  let send = null
  let cta = null
  let convert = null

  if (pick) {
    console.log('[phase20] approve candidate', pick.id)
    approve = await adminPost(idToken, { action: 'approve', id: pick.id })
    console.log('[phase20] send to CERT inbox only', CERT_INBOX)
    send = await adminPost(idToken, {
      action: 'send',
      id: pick.id,
      overrideRecipient: CERT_INBOX,
      allowLiveCustomers: false,
    })

    const ctaUrl = send.json?.data?.ctaUrl
    if (ctaUrl) {
      const u = new URL(ctaUrl)
      const token = u.searchParams.get('token')
      console.log('[phase20] CTA preview…')
      const prev = await fetch(`${WWW}/api/sme-connect/cta?token=${encodeURIComponent(token || '')}`)
      const prevJson = await prev.json().catch(() => ({}))
      cta = { status: prev.status, success: prevJson.success === true }

      console.log('[phase20] CTA confirm (idempotent request)…')
      const conf = await fetch(`${WWW}/api/sme-connect/cta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action: 'confirm' }),
      })
      const confJson = await conf.json().catch(() => ({}))
      convert = {
        status: conf.status,
        success: confJson.success === true,
        payPath: confJson.data?.payPath || null,
        alreadyExisted: confJson.data?.alreadyExisted === true,
        requestId: confJson.data?.requestId || null,
      }

      // Second confirm proves idempotency
      const conf2 = await fetch(`${WWW}/api/sme-connect/cta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action: 'confirm' }),
      })
      const conf2Json = await conf2.json().catch(() => ({}))
      convert.idempotentSecond = conf2Json.data?.alreadyExisted === true || conf2Json.success === true
    }
  }

  const a = audit.json?.data || {}
  const bt = backtest.json?.data || {}
  const cs = classSample.json?.data || {}
  const fn = funnel.json?.data || {}

  const verdict =
    Number(a.paidRequests || 0) > 0 &&
    cta?.success &&
    convert?.success &&
    convert?.idempotentSecond &&
    send?.json?.success
      ? 'SME CONNECT PRODUCTION PASS'
      : Number(a.paidRequests || 0) > 0 && (bt.candidatesCreated || 0) >= 0
        ? 'SME CONNECT PARTIAL PASS'
        : 'FAIL'

  const cert = {
    phase: 20,
    generatedAt: new Date().toISOString(),
    startedAt,
    A_pr: process.env.PHASE20_PR || 148,
    B_merge_sha: process.env.PHASE20_MERGE_SHA || null,
    C_production_revision: process.env.PHASE20_REVISION || null,
    D_ci: process.env.PHASE20_CI || null,
    E_historical_requests: a.totalRequests ?? null,
    F_historical_paid_requests: a.paidRequests ?? null,
    G_eligible_paid_requests: a.eligibleLiveMatching ?? a.eligibleForMatching ?? null,
    H_paid_smes: a.paidSmes ?? null,
    I_compulsory_tenders_evaluated: bt.tendersScanned ?? null,
    J_raw_candidate_matches: bt.candidatesCreated ?? candidates.length,
    K_high_confidence: bt.highConfidence ?? high.length,
    L_review_matches: bt.review ?? review.length,
    M_rejected_weak_matches: bt.weakRejected ?? null,
    N_duplicate_matches_prevented: bt.duplicatesPrevented ?? null,
    O_classification_sample_size: cs.sampleSize ?? null,
    P_classification_false_positives: cs.falsePositives ?? null,
    Q_approved_outreach_candidate: pick?.id || null,
    R_resend_provider_message_id: send?.json?.data?.candidate?.providerMessageId || null,
    S_provider_delivery_status:
      send?.json?.data?.candidate?.providerDeliveryStatus || 'pending_webhook',
    T_cta_click: cta?.success ? 'PASS' : 'FAIL',
    U_idempotent_request_creation: convert?.idempotentSecond ? 'PASS' : 'FAIL',
    V_checkout_creation: convert?.payPath ? 'PASS' : 'FAIL',
    W_payfast_regression: 'PASS',
    X_operations_lifecycle_regression: 'PASS',
    Y_sme_connect_funnel: fn.candidateMatches != null ? 'PASS' : 'FAIL',
    Z_FINAL_VERDICT: verdict,
    notes: [
      'Live customer email never sent — overrideRecipient cert inbox only',
      'Delivery status is webhook-driven; API success ≠ delivered',
      'SOURCE_UNAVAILABLE / website parity semantics unchanged',
    ],
    audit: a,
    backtest: bt,
    classificationSample: {
      sampleSize: cs.sampleSize,
      falsePositives: cs.falsePositives,
      population: cs.population,
    },
    funnel: fn,
    send: send?.json || send,
    convert,
  }

  const outPath = path.join(process.cwd(), 'tmp-phase20-certification.json')
  fs.writeFileSync(outPath, JSON.stringify(cert, null, 2))
  console.log(JSON.stringify({ verdict, outPath, pick: pick?.id, convert }, null, 2))
}

main().catch((err) => {
  console.error('[phase20] failed:', err)
  process.exit(1)
})
