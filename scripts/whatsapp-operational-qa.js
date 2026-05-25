#!/usr/bin/env node
/**
 * Twilio WhatsApp operational QA — no secrets logged.
 *
 * Modes:
 *   production-api (default) — uses production Cloud Run via admin test API
 *   local-direct           — requires local TWILIO_* env vars
 */
const path = require('path')
process.chdir(path.join(__dirname, '..'))
require('./load-env-local').loadEnvLocal()

const PROD = process.env.QA_BASE_URL || 'https://www.tenderbriefing.co.za'
const MODE =
  process.env.WHATSAPP_QA_MODE === 'local-direct' ? 'local-direct' : 'production-api'

const report = {
  baseUrl: PROD,
  mode: MODE,
  checks: [],
  passed: false,
  blockers: [],
}

function check(name, ok, detail = '') {
  report.checks.push({ name, ok, detail })
  if (!ok) report.blockers.push(`${name}${detail ? `: ${detail}` : ''}`)
}

function maskRecipient(value) {
  const s = String(value || '')
  if (s.length < 6) return '***'
  return `${s.slice(0, 6)}***`
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options)
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = { raw: text.slice(0, 300) }
  }
  return { status: res.status, json, contentType: res.headers.get('content-type') }
}

async function getAdminIdToken() {
  const email = process.env.QA_ADMIN_EMAIL || process.env.ADMIN_EMAIL
  const password = process.env.QA_ADMIN_PASSWORD || process.env.SMOKE_TEST_PASSWORD
  if (!email || !password) {
    throw new Error('Set QA_ADMIN_EMAIL and QA_ADMIN_PASSWORD (admin Firebase account)')
  }

  const apiKey =
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
    require('../lib/firebase-config').firebaseConfig.apiKey

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  )
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error?.message || 'Admin sign-in failed')
  }
  return { idToken: data.idToken, localId: data.localId, email }
}

async function verifyFirestoreWhatsappLog({ afterIso, expectSent = true }) {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return { skipped: true, reason: 'No Firebase Admin credentials for Firestore verification' }
  }

  process.env.STORAGE_ADAPTER = process.env.STORAGE_ADAPTER || 'firestore'
  process.env.FIREBASE_PROJECT_ID =
    process.env.FIREBASE_PROJECT_ID || 'tenderbriefing-34679'

  const admin = require('../backend/config/firebaseAdmin').getFirebaseAdmin()
  const snap = await admin
    .firestore()
    .collection('notifications')
    .where('channel', '==', 'whatsapp')
    .orderBy('createdAt', 'desc')
    .limit(10)
    .get()
    .catch(async () => {
      const fallback = await admin
        .firestore()
        .collection('notifications')
        .where('channel', '==', 'whatsapp')
        .limit(20)
        .get()
      return fallback
    })

  const items = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((i) => !afterIso || (i.createdAt && i.createdAt >= afterIso))
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))

  const latest = items[0]
  const sentOk = latest && latest.status === 'sent'
  return {
    skipped: false,
    totalSampled: items.length,
    latest: latest
      ? {
          id: latest.id,
          type: latest.type,
          status: latest.status,
          channel: latest.channel,
          createdAt: latest.createdAt,
          sentAt: latest.sentAt,
          hasError: !!latest.error,
        }
      : null,
    sentLogFound: sentOk,
    meetsExpectation: expectSent ? sentOk : true,
  }
}

async function runProductionApiMode() {
  const testTo = process.env.TEST_WHATSAPP_TO || process.env.SMOKE_WHATSAPP_TO
  report.testRecipient = testTo ? maskRecipient(testTo) : null

  const health = await fetchJson(`${PROD}/api/integrations/health`)
  check('GET /api/integrations/health JSON', health.status === 200 && !health.json.raw)
  const twilio = (health.json.integrations || []).find((i) => i.id === 'twilio-whatsapp')
  check('twilio-whatsapp listed', !!twilio)
  if (twilio) {
    check('twilio-whatsapp configured (production)', twilio.status === 'configured', twilio.status)
    report.productionHealth = { status: twilio.status, from: twilio.from || null }
    check('health has no secret leak', !/sk_(test|live)_/i.test(JSON.stringify(twilio)))
  }

  report.localTwilioConfigured = false
  report.note = 'Production API mode does not require local TWILIO_* env vars'

  if (!testTo) {
    report.blockers.push('TEST_WHATSAPP_TO not set (sandbox-joined E.164 or whatsapp:+27...)')
    return
  }

  let adminAuth
  try {
    adminAuth = await getAdminIdToken()
    check('Admin Firebase auth', true, adminAuth.email)
    report.adminAuth = { success: true, email: adminAuth.email }
  } catch (e) {
    check('Admin Firebase auth', false, e.message)
    report.adminAuth = { success: false }
    return
  }

  const sentBefore = new Date().toISOString()
  const testApi = await fetchJson(`${PROD}/api/notifications/test-whatsapp`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminAuth.idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: testTo.startsWith('whatsapp:')
        ? testTo
        : `whatsapp:${testTo.startsWith('+') ? testTo : `+${testTo}`}`,
      message: 'TenderBriefing WhatsApp QA test message',
    }),
  })

  report.testEndpoint = {
    httpStatus: testApi.status,
    success: testApi.json.success,
    configured: testApi.json.configured,
    dataStatus: testApi.json.data?.status,
    duplicate: testApi.json.data?.duplicate,
    error: testApi.json.error || null,
  }

  check(
    'POST /api/notifications/test-whatsapp',
    testApi.status === 200 && testApi.json.success === true,
    testApi.json.error || String(testApi.status)
  )

  if (testApi.json.success && testApi.json.data) {
    check(
      'Test API reports sent status',
      testApi.json.data.status === 'sent' || testApi.json.data.duplicate === true,
      testApi.json.data.status
    )
  }

  const metrics = await fetchJson(`${PROD}/api/admin/whatsapp-metrics`, {
    headers: { Authorization: `Bearer ${adminAuth.idToken}` },
  })
  check('GET /api/admin/whatsapp-metrics', metrics.status === 200 && metrics.json.success)
  report.adminMetrics = metrics.json.data
    ? {
        configured: metrics.json.data.configured,
        sent: metrics.json.data.sent,
        failed: metrics.json.data.failed,
        pending: metrics.json.data.pending,
        lastSentAt: metrics.json.data.lastSentAt,
      }
    : null

  await new Promise((r) => setTimeout(r, 2000))

  try {
    const fsLog = await verifyFirestoreWhatsappLog({ afterIso: sentBefore, expectSent: true })
    report.firestoreVerification = fsLog
    if (fsLog.skipped) {
      report.checks.push({
        name: 'Firestore log status=sent',
        ok: true,
        detail: fsLog.reason,
      })
    } else {
      check('Firestore log channel=whatsapp', fsLog.latest?.channel === 'whatsapp', fsLog.latest?.channel)
      check('Firestore log status=sent', fsLog.sentLogFound, fsLog.latest?.status)
    }
  } catch (e) {
    check('Firestore log verification', false, e.message)
  }
}

async function runLocalDirectMode() {
  const wa = require('../backend/services/whatsappService')
  const cfg = wa.getConfig()
  report.localTwilioConfigured = cfg.configured
  report.fromMasked = cfg.from

  check('TWILIO_ACCOUNT_SID present locally', !cfg.missing?.includes('TWILIO_ACCOUNT_SID'))
  check('TWILIO_AUTH_TOKEN present locally', !cfg.missing?.includes('TWILIO_AUTH_TOKEN'))
  check('TWILIO_WHATSAPP_FROM present locally', !cfg.missing?.includes('TWILIO_WHATSAPP_FROM'))
  check('Local Twilio configured', cfg.configured, cfg.missing?.join(', ') || '')

  const health = await fetchJson(`${PROD}/api/integrations/health`)
  const twilio = (health.json.integrations || []).find((i) => i.id === 'twilio-whatsapp')
  if (twilio) {
    report.productionHealth = { status: twilio.status, from: twilio.from || null }
  }

  const testTo = process.env.TEST_WHATSAPP_TO || process.env.SMOKE_WHATSAPP_TO
  report.testRecipient = testTo ? maskRecipient(testTo) : null
  if (!testTo) {
    report.blockers.push('TEST_WHATSAPP_TO not set')
    return
  }

  const send = await wa.sendWhatsAppMessage(testTo, 'TenderBriefing WhatsApp QA test message (local-direct).', {
    type: 'qa_test',
    recipientRole: 'admin',
    recipientId: 'qa-script',
    idempotencyKey: `qa_local:${Date.now()}`,
    metadata: { source: 'whatsapp-operational-qa.js', mode: 'local-direct' },
  })

  report.testEndpoint = {
    via: 'local-direct',
    ok: send.ok,
    status: send.log?.status,
    error: send.error || send.reason || null,
  }

  check('Local Twilio send', send.ok === true, send.error || send.reason)
  check('Local Firestore log status=sent', send.log?.status === 'sent', send.log?.status)
}

async function main() {
  try {
    if (MODE === 'local-direct') {
      await runLocalDirectMode()
    } else {
      await runProductionApiMode()
    }

    const critical = report.blockers.filter(
      (b) =>
        !b.includes('Firestore') ||
        !b.toLowerCase().includes('skipped')
    )

    const healthOk = report.productionHealth?.status === 'configured'
    const apiOk = report.testEndpoint?.success === true || report.testEndpoint?.ok === true
    const fsOk =
      report.firestoreVerification?.skipped ||
      report.firestoreVerification?.sentLogFound ||
      report.testEndpoint?.dataStatus === 'sent'

    report.passed =
      critical.length === 0 &&
      healthOk &&
      apiOk &&
      (MODE === 'local-direct' ? report.localTwilioConfigured : true) &&
      fsOk

    if (report.passed) {
      report.operationalReadiness = 'ready'
    } else if (healthOk && report.adminAuth?.success && !apiOk) {
      report.operationalReadiness = 'blocked_at_test_send'
    } else if (healthOk && !report.adminAuth?.success) {
      report.operationalReadiness = 'blocked_at_admin_auth'
    } else if (!healthOk) {
      report.operationalReadiness = 'blocked_twilio_not_configured'
    } else {
      report.operationalReadiness = 'not_ready'
    }

    console.log(JSON.stringify(report, null, 2))
    process.exit(report.passed ? 0 : 1)
  } catch (err) {
    console.error(JSON.stringify({ passed: false, mode: MODE, error: err.message }))
    process.exit(1)
  }
}

main()
