#!/usr/bin/env node
/**
 * PayFast readiness check — production API only, no secrets logged.
 * Verifies non-payment flow, agent visibility gate, and admin-visible pending requests.
 */
const path = require('path')
process.chdir(path.join(__dirname, '..'))
require('./load-env-local').loadEnvLocal()
const { resolveBriefingPriceCents, BRIEFING_PRICE_CURRENCY } = require('../backend/constants/briefingPricing')

const CANONICAL_BRIEFING_PRICE_CENTS = resolveBriefingPriceCents()

const PROD_BASE =
  process.env.PAYFAST_READINESS_BASE_URL ||
  'https://www.tenderbriefing.co.za'

const SME_EMAIL = 'ops-smoke-sme@tenderbriefing.co.za'
const AGENT_EMAIL = 'ops-smoke-agent@tenderbriefing.co.za'
const TEST_PASSWORD = process.env.SMOKE_TEST_PASSWORD
if (!TEST_PASSWORD) {
  console.warn(
    'SMOKE_TEST_PASSWORD unset — PayFast readiness will use Admin custom tokens (service account).'
  )
}

const report = {
  baseUrl: PROD_BASE,
  checks: [],
  passed: false,
  blockers: [],
}

function check(name, ok, detail = '') {
  report.checks.push({ name, ok, detail })
  if (!ok) report.blockers.push(`${name}${detail ? `: ${detail}` : ''}`)
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options)
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = { raw: text.slice(0, 200) }
  }
  return { status: res.status, json, contentType: res.headers.get('content-type') }
}

async function getIdToken(email, password) {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  if (!apiKey) throw new Error('NEXT_PUBLIC_FIREBASE_API_KEY missing from .env.local')

  if (password) {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      }
    )
    const data = await res.json()
    if (res.ok) return data.idToken
  }

  process.env.STORAGE_ADAPTER = process.env.STORAGE_ADAPTER || 'firestore'
  process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'tenderbriefing-34679'
  const { getFirebaseAdmin } = require('../backend/config/firebaseAdmin')
  const admin = getFirebaseAdmin()
  const user = await admin.auth().getUserByEmail(email)
  const customToken = await admin.auth().createCustomToken(user.uid)
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    }
  )
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || 'customToken signIn failed')
  return data.idToken
}

async function main() {
  // Integration health — PayFast should be missing or configured, never expose secrets.
  // Some production builds auth-gate this route; booking/checkout path remains authoritative.
  const health = await fetchJson(`${PROD_BASE}/api/integrations/health`)
  const healthOk =
    (health.status === 200 && health.json.success !== false && !health.json.raw) ||
    health.status === 401 ||
    health.status === 403
  check(
    'GET /api/integrations/health reachable or auth-gated',
    healthOk,
    `status ${health.status}`
  )
  const yoco = (health.json.integrations || []).find((i) => i.id === 'payfast')
  if (health.status === 200) {
    check('PayFast integration listed in health', !!yoco, yoco ? '' : 'missing payfast entry')
    if (yoco) {
      const healthStr = JSON.stringify(yoco)
      check(
        'Health response contains no sk_ key pattern',
        !/sk_(test|live)_/i.test(healthStr),
        'possible secret leak'
      )
      report.payfastHealth = { status: yoco.status, missing: yoco.missing }
    }
  } else {
    check(
      'PayFast health auth-gated — defer to checkout path proof',
      true,
      `status ${health.status}`
    )
  }

  const smeToken = await getIdToken(SME_EMAIL, TEST_PASSWORD)
  const agentToken = await getIdToken(AGENT_EMAIL, TEST_PASSWORD)
  const smeHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${smeToken}`,
  }
  const agentHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${agentToken}`,
  }

  const tendersRes = await fetchJson(`${PROD_BASE}/api/tender-briefings`)
  const compulsory = (tendersRes.json.data || []).filter((t) => t.briefingCompulsory)
  check('Compulsory tenders available', compulsory.length > 0)

  const existing = await fetchJson(`${PROD_BASE}/api/attendance-requests`, {
    headers: smeHeaders,
  })
  const activeTenderIds = new Set(
    (existing.json.data || [])
      .filter((r) => ['pending', 'assigned', 'accepted'].includes(r.status))
      .map((r) => r.tenderId)
  )
  const tender = compulsory.find((t) => !activeTenderIds.has(t.id)) || compulsory[0]

  const createRes = await fetchJson(`${PROD_BASE}/api/attendance-requests`, {
    method: 'POST',
    headers: smeHeaders,
    body: JSON.stringify({
      tenderId: tender.id,
      notes: 'PayFast readiness check — safe test',
      responsibilityAcknowledged: true,
    }),
  })

  let requestId = createRes.json.data?.request?.id
  let req = createRes.json.data?.request
  let usedExistingPending = false

  if (!requestId && !createRes.json.success) {
    const pendingExisting = (existing.json.data || []).find(
      (r) =>
        r.paymentStatus === 'pending' &&
        (r.status === 'pending' || !r.status)
    )
    if (pendingExisting) {
      requestId = pendingExisting.id
      req = pendingExisting
      usedExistingPending = true
      check(
        'Reused existing SME pending request (create blocked by active duplicate)',
        true,
        requestId
      )
    }
  }

  check(
    'POST attendance-request returns JSON (no HTML error page)',
    !createRes.json.raw && createRes.json.success !== undefined,
    `status ${createRes.status}`
  )

  const createdOk =
    usedExistingPending ||
    createRes.json.success === true ||
    createRes.json.code === 'PAYFAST_NOT_CONFIGURED' ||
    (createRes.status === 503 && requestId)
  check('Attendance request created or returned with id', !!requestId && createdOk)
  if (req) {
    check('paymentStatus is pending', req.paymentStatus === 'pending', req.paymentStatus)
    check('paymentProvider is payfast', req.paymentProvider === 'payfast', req.paymentProvider)
    check(
      `paymentAmount is ${CANONICAL_BRIEFING_PRICE_CENTS}`,
      req.paymentAmount === CANONICAL_BRIEFING_PRICE_CENTS,
      String(req.paymentAmount)
    )
    check('currency is ZAR', req.currency === BRIEFING_PRICE_CURRENCY, req.currency)
    check(
      'paymentReference format TB-REQ-*',
      /^TB-REQ-/.test(req.paymentReference || ''),
      req.paymentReference
    )
  }

  const payment = createRes.json.data?.payment
  if (payment?.code === 'PAYFAST_NOT_CONFIGURED' || createRes.json.code === 'PAYFAST_NOT_CONFIGURED') {
    check('YOCO_NOT_CONFIGURED returned when checkout unavailable', true)
    report.payfastConfigured = false
  } else if ((payment?.formAction && payment?.fields) || payment?.redirectUrl) {
    report.payfastConfigured = true
    check(
      'Checkout formAction/fields present (PayFast configured)',
      !!(payment?.formAction && payment?.fields) || !!payment?.redirectUrl
    )
    if (payment?.fields) {
      const amount = String(payment.fields.amount || '')
      const expectedZar = (CANONICAL_BRIEFING_PRICE_CENTS / 100).toFixed(2)
      check(`PayFast amount field is ${expectedZar}`, amount === expectedZar, amount)
      check(
        'PayFast notify_url is production webhook',
        String(payment.fields.notify_url || '') ===
          'https://www.tenderbriefing.co.za/api/webhooks/payfast' ||
          String(payment.fields.notify_url || '').endsWith('/api/webhooks/payfast'),
        String(payment.fields.notify_url || '').slice(0, 80)
      )
      check(
        'PayFast return_url present',
        Boolean(payment.fields.return_url),
        String(payment.fields.return_url || '').slice(0, 60)
      )
      check(
        'PayFast cancel_url present',
        Boolean(payment.fields.cancel_url),
        String(payment.fields.cancel_url || '').slice(0, 60)
      )
      check(
        'merchant reference uses TB-REQ-*',
        /^TB-REQ-/.test(String(payment.fields.m_payment_id || req?.paymentReference || '')),
        String(payment.fields.m_payment_id || req?.paymentReference || '')
      )
    }
  } else if (usedExistingPending) {
    report.payfastConfigured = false
    check('Existing pending request used (create-checkout verifies PayFast state)', true)
  } else if (createRes.json.success) {
    report.payfastConfigured = !!(payment?.formAction || payment?.redirectUrl)
    check('Create response includes payment object', !!payment, JSON.stringify(payment || {}).slice(0, 80))
  }

  const checkoutRetry = requestId
    ? await fetchJson(`${PROD_BASE}/api/payments/payfast/create-checkout`, {
        method: 'POST',
        headers: smeHeaders,
        body: JSON.stringify({ attendanceRequestId: requestId }),
      })
    : { status: 0, json: {}, contentType: '' }

  if (!report.payfastConfigured && requestId) {
    const notConfigured =
      checkoutRetry.json.code === 'PAYFAST_NOT_CONFIGURED' &&
      (checkoutRetry.status === 503 || checkoutRetry.status === 400)
    check(
      'create-checkout returns PAYFAST_NOT_CONFIGURED without crash',
      notConfigured,
      `status ${checkoutRetry.status} code ${checkoutRetry.json.code || checkoutRetry.json.error}`
    )
    check(
      'create-checkout error is JSON only',
      (checkoutRetry.contentType || '').includes('application/json'),
      checkoutRetry.contentType
    )
  }

  const opps = await fetchJson(`${PROD_BASE}/api/attendance-requests?opportunities=true`, {
    headers: agentHeaders,
  })
  const oppsIds = (opps.json.data || []).map((r) => r.id)
  check(
    'Unpaid request hidden from agent opportunities',
    req?.paymentStatus !== 'pending' || !oppsIds.includes(requestId),
    oppsIds.includes(requestId) ? 'request visible to agent' : ''
  )

  const acceptRes = await fetchJson(
    `${PROD_BASE}/api/attendance-requests/${requestId}/accept`,
    { method: 'POST', headers: agentHeaders }
  )
  check(
    'Agent accept blocked for unpaid request',
    req?.paymentStatus !== 'pending' || !acceptRes.json.success,
    acceptRes.json.error || 'accept succeeded when unpaid'
  )
  check(
    'Accept error is friendly JSON',
    acceptRes.json.success === false || acceptRes.status >= 400
      ? (acceptRes.contentType || '').includes('application/json')
      : true,
    acceptRes.json.error
  )

  // Snapshot / path regressions — no private-tender-specific payment module
  const {
    BRIEFING_PRICE_CENTS,
  } = require('../backend/constants/briefingPricing')
  check(
    'Canonical briefing price is R349 (34900 cents)',
    BRIEFING_PRICE_CENTS === 34900,
    String(BRIEFING_PRICE_CENTS)
  )
  const fs = require('fs')
  const path = require('path')
  check(
    'No privateBooking / private payment path introduced',
    !fs.existsSync(path.join(process.cwd(), 'app/api/private-bookings')) &&
      !fs.existsSync(path.join(process.cwd(), 'backend/services/privateBooking.js')),
    'private booking module present'
  )

  report.passed = report.blockers.length === 0
  console.log(JSON.stringify(report, null, 2))
  process.exit(report.passed ? 0 : 1)
}

main().catch((err) => {
  console.error(JSON.stringify({ passed: false, error: err.message }))
  process.exit(1)
})
