#!/usr/bin/env node
/**
 * Yoco readiness check — production API only, no secrets logged.
 * Verifies non-payment flow, agent visibility gate, and admin-visible pending requests.
 */
const path = require('path')
process.chdir(path.join(__dirname, '..'))
require('./load-env-local').loadEnvLocal()

const PROD_BASE =
  process.env.YOCO_READINESS_BASE_URL ||
  'https://www.tenderbriefing.co.za'

const SME_EMAIL = 'ops-smoke-sme@tenderbriefing.co.za'
const AGENT_EMAIL = 'ops-smoke-agent@tenderbriefing.co.za'
const TEST_PASSWORD = process.env.SMOKE_TEST_PASSWORD || 'TenderBriefing_Smoke2026!'

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
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  )
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || 'signIn failed')
  return data.idToken
}

async function main() {
  // Integration health — Yoco should be missing or configured, never expose secrets
  const health = await fetchJson(`${PROD_BASE}/api/integrations/health`)
  check(
    'GET /api/integrations/health returns JSON',
    health.status === 200 && health.json.success !== false && !health.json.raw,
    `status ${health.status}`
  )
  const yoco = (health.json.integrations || []).find((i) => i.id === 'yoco')
  check('Yoco integration listed in health', !!yoco, yoco ? '' : 'missing yoco entry')
  if (yoco) {
    const healthStr = JSON.stringify(yoco)
    check(
      'Health response contains no sk_ key pattern',
      !/sk_(test|live)_/i.test(healthStr),
      'possible secret leak'
    )
    report.yocoHealth = { status: yoco.status, missing: yoco.missing }
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
      notes: 'Yoco readiness check — safe test',
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
    createRes.json.code === 'YOCO_NOT_CONFIGURED' ||
    (createRes.status === 503 && requestId)
  check('Attendance request created or returned with id', !!requestId && createdOk)
  if (req) {
    check('paymentStatus is pending', req.paymentStatus === 'pending', req.paymentStatus)
    check('paymentProvider is yoco', req.paymentProvider === 'yoco', req.paymentProvider)
    check('paymentAmount is 24900', req.paymentAmount === 24900, String(req.paymentAmount))
    check('currency is ZAR', req.currency === 'ZAR', req.currency)
    check(
      'paymentReference format TB-REQ-*',
      /^TB-REQ-/.test(req.paymentReference || ''),
      req.paymentReference
    )
  }

  const payment = createRes.json.data?.payment
  if (payment?.code === 'YOCO_NOT_CONFIGURED' || createRes.json.code === 'YOCO_NOT_CONFIGURED') {
    check('YOCO_NOT_CONFIGURED returned when checkout unavailable', true)
    report.yocoConfigured = false
  } else if (payment?.redirectUrl) {
    report.yocoConfigured = true
    check('Checkout redirect URL present (Yoco configured)', true)
  } else if (usedExistingPending) {
    report.yocoConfigured = false
    check('Existing pending request used (create-checkout verifies Yoco state)', true)
  } else if (createRes.json.success) {
    report.yocoConfigured = !!payment?.redirectUrl
    check('Create response includes payment object', !!payment, JSON.stringify(payment || {}).slice(0, 80))
  }

  const checkoutRetry = requestId
    ? await fetchJson(`${PROD_BASE}/api/payments/yoco/create-checkout`, {
        method: 'POST',
        headers: smeHeaders,
        body: JSON.stringify({ attendanceRequestId: requestId }),
      })
    : { status: 0, json: {}, contentType: '' }

  if (!report.yocoConfigured && requestId) {
    const notConfigured =
      checkoutRetry.json.code === 'YOCO_NOT_CONFIGURED' &&
      (checkoutRetry.status === 503 || checkoutRetry.status === 400)
    check(
      'create-checkout returns YOCO_NOT_CONFIGURED without crash',
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

  report.passed = report.blockers.length === 0
  console.log(JSON.stringify(report, null, 2))
  process.exit(report.passed ? 0 : 1)
}

main().catch((err) => {
  console.error(JSON.stringify({ passed: false, error: err.message }))
  process.exit(1)
})
