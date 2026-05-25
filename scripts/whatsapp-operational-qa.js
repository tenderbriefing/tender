#!/usr/bin/env node
/**
 * Twilio WhatsApp operational QA — production checks, no secrets logged.
 */
const path = require('path')
process.chdir(path.join(__dirname, '..'))
require('./load-env-local').loadEnvLocal()

const PROD = process.env.QA_BASE_URL || 'https://www.tenderbriefing.co.za'
const report = {
  baseUrl: PROD,
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
    json = { raw: text.slice(0, 300) }
  }
  return { status: res.status, json, contentType: res.headers.get('content-type') }
}

async function getIdToken(email, password) {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  if (!apiKey) throw new Error('NEXT_PUBLIC_FIREBASE_API_KEY missing')
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
  // 1. Integration health
  const health = await fetchJson(`${PROD}/api/integrations/health`)
  check('GET /api/integrations/health JSON', health.status === 200 && !health.json.raw)
  const twilio = (health.json.integrations || []).find((i) => i.id === 'twilio-whatsapp')
  check('twilio-whatsapp listed', !!twilio)
  if (twilio) {
    check('twilio-whatsapp configured', twilio.status === 'configured', twilio.status)
    report.twilioHealth = { status: twilio.status, from: twilio.from || null }
    const blob = JSON.stringify(twilio)
    check('health has no sk_ leak', !/sk_(test|live)_/i.test(blob))
  }

  // 2. Runtime secrets (local module only — names, not values)
  const wa = require('../backend/services/whatsappService')
  const cfg = wa.getConfig()
  check('TWILIO_ACCOUNT_SID present locally', cfg.missing?.includes('TWILIO_ACCOUNT_SID') === false)
  check('TWILIO_AUTH_TOKEN present locally', cfg.missing?.includes('TWILIO_AUTH_TOKEN') === false)
  check('TWILIO_WHATSAPP_FROM present locally', cfg.missing?.includes('TWILIO_WHATSAPP_FROM') === false)
  report.secretsConfiguredLocally = cfg.configured
  report.fromMasked = cfg.from

  // 3. Firestore whatsapp logs
  let waStats = { sent: 0, failed: 0, latest: [] }
  try {
    const admin = require('../backend/config/firebaseAdmin').getFirebaseAdmin()
    const snap = await admin
      .firestore()
      .collection('notifications')
      .where('channel', '==', 'whatsapp')
      .limit(50)
      .get()
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    waStats.sent = items.filter((i) => i.status === 'sent').length
    waStats.failed = items.filter((i) => i.status === 'failed').length
    waStats.latest = items
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 5)
      .map((i) => ({
        id: i.id,
        type: i.type,
        status: i.status,
        recipientRole: i.recipientRole,
        createdAt: i.createdAt,
        sentAt: i.sentAt,
        hasError: !!i.error,
      }))
    check('Firestore notifications collection readable', true, `${items.length} whatsapp docs sampled`)
    report.firestoreWhatsapp = waStats
  } catch (e) {
    check('Firestore notifications collection readable', false, e.message)
  }

  // 4–6. Test send (only if TEST_WHATSAPP_TO set — never log number)
  const testTo = process.env.TEST_WHATSAPP_TO || process.env.SMOKE_WHATSAPP_TO
  report.testRecipientConfigured = !!testTo
  if (testTo) {
    const masked = `${String(testTo).slice(0, 4)}***`
    const send = await wa.sendWhatsAppMessage(
      testTo,
      'TenderBriefing QA: Twilio WhatsApp operational test.',
      {
        type: 'qa_test',
        recipientRole: 'admin',
        recipientId: 'qa-script',
        idempotencyKey: `qa_test:${Date.now()}`,
        metadata: { source: 'whatsapp-operational-qa.js' },
      }
    )
    check('Twilio send API success', send.ok === true, send.error || send.reason || masked)
    check('Firestore log status sent', send.log?.status === 'sent', send.log?.status)
    report.lastSend = {
      ok: send.ok,
      duplicate: send.duplicate,
      status: send.log?.status,
      sid: send.sid ? 'present' : null,
    }
    const dup = await wa.sendWhatsAppMessage(testTo, 'duplicate test', {
      type: 'qa_test',
      recipientRole: 'admin',
      recipientId: 'qa-script',
      idempotencyKey: `qa_test:${Date.now()}`,
    })
    // second with same key immediately
    const key = `qa_dup:${Date.now()}`
    await wa.sendWhatsAppMessage(testTo, 'dup1', {
      type: 'qa_dup',
      recipientRole: 'admin',
      recipientId: 'qa',
      idempotencyKey: key,
    })
    const dup2 = await wa.sendWhatsAppMessage(testTo, 'dup2', {
      type: 'qa_dup',
      recipientRole: 'admin',
      recipientId: 'qa',
      idempotencyKey: key,
    })
    check('Idempotency prevents duplicate', dup2.duplicate === true || dup2.skipped)
  } else {
    report.blockers.push(
      'TEST_WHATSAPP_TO not set — skip live message send (set env to your sandbox-joined E.164)'
    )
  }

  // 8. Admin metrics API
  try {
    const adminEmail = process.env.QA_ADMIN_EMAIL || process.env.ADMIN_EMAIL
    const adminPass = process.env.QA_ADMIN_PASSWORD || process.env.SMOKE_TEST_PASSWORD
    if (adminEmail && adminPass) {
      const token = await getIdToken(adminEmail, adminPass)
      const metrics = await fetchJson(`${PROD}/api/admin/whatsapp-metrics`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      check('GET /api/admin/whatsapp-metrics', metrics.status === 200 && metrics.json.success)
      report.adminMetrics = metrics.json.data
        ? {
            configured: metrics.json.data.configured,
            sent: metrics.json.data.sent,
            failed: metrics.json.data.failed,
            pending: metrics.json.data.pending,
          }
        : null
      const testApi = await fetchJson(`${PROD}/api/notifications/test-whatsapp`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: testTo || '+27000000000',
          message: 'TenderBriefing admin API QA test',
        }),
      })
      if (testTo) {
        check(
          'POST /api/notifications/test-whatsapp',
          testApi.status === 200 && testApi.json.success,
          testApi.json.error || String(testApi.status)
        )
      } else {
        report.checks.push({
          name: 'POST /api/notifications/test-whatsapp',
          ok: false,
          detail: 'skipped — no TEST_WHATSAPP_TO',
        })
      }
    } else {
      report.checks.push({
        name: 'Admin API tests',
        ok: false,
        detail: 'Set QA_ADMIN_EMAIL + QA_ADMIN_PASSWORD or ADMIN_EMAIL + SMOKE_TEST_PASSWORD',
      })
    }
  } catch (e) {
    check('Admin metrics API', false, e.message)
  }

  const hardBlockers = report.blockers.filter(
    (b) => !b.includes('TEST_WHATSAPP_TO not set') && !b.includes('skipped')
  )
  report.passed = hardBlockers.length === 0 && twilio?.status === 'configured'
  report.operationalReadiness =
    twilio?.status === 'configured' && cfg.configured
      ? testTo
        ? 'ready_with_live_send'
        : 'ready_pending_test_number'
      : 'not_ready'

  console.log(JSON.stringify(report, null, 2))
  process.exit(report.passed ? 0 : 1)
}

main().catch((err) => {
  console.error(JSON.stringify({ passed: false, error: err.message }))
  process.exit(1)
})
