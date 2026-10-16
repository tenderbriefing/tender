#!/usr/bin/env node
/**
 * Phase 12 controlled production certification.
 * Uses founder/test recipient only. Never PayFast. Stops if no approved test mailbox.
 */
const fs = require('fs')
const path = require('path')

require('./load-env-local').loadEnvLocal()
process.env.GOOGLE_APPLICATION_CREDENTIALS = path.resolve('service-account.json')
process.env.STORAGE_ADAPTER = 'firestore'
process.env.FIREBASE_PROJECT_ID =
  process.env.FIREBASE_PROJECT_ID || 'tenderbriefing-34679'

const BASE = process.env.PHASE12_CERT_BASE || 'https://www.tenderbriefing.co.za'
const ADMIN_EMAIL = process.env.FOUNDER_ADMIN_EMAIL || 'info@tenderbriefing.co.za'
/** Controlled test recipient — never a real client unless explicitly set */
const TEST_RECIPIENT =
  process.env.PHASE12_TEST_RECIPIENT ||
  process.env.FOUNDER_EMAIL_ALLOWLIST?.split(',')[0]?.trim() ||
  ADMIN_EMAIL

const outJson = path.resolve('tmp-phase12-delivery-prod-cert.json')
const checks = []
function check(name, ok, detail) {
  checks.push({ name, ok: Boolean(ok), detail: detail == null ? null : String(detail) })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail != null ? ` — ${detail}` : ''}`)
}

async function getAdminIdToken() {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  if (!apiKey) throw new Error('NEXT_PUBLIC_FIREBASE_API_KEY missing')
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
  if (!res.ok) throw new Error(data.error?.message || 'admin signIn failed')
  return { idToken: data.idToken, uid: data.localId || user.uid, email: ADMIN_EMAIL }
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options)
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = { raw: text.slice(0, 500) }
  }
  return { status: res.status, json }
}

async function main() {
  const { BRIEFING_PRICE_CENTS } = require('../backend/constants/briefingPricing')
  check('BRIEFING_PRICE_CENTS=75000', BRIEFING_PRICE_CENTS === 75000, BRIEFING_PRICE_CENTS)

  const approvedDomains = ['tenderbriefing.co.za', 'tenderbriefing.test', 'example.test']
  const recipientDomain = String(TEST_RECIPIENT).split('@')[1] || ''
  const recipientAllowed =
    approvedDomains.some((d) => recipientDomain.endsWith(d)) ||
    process.env.PHASE12_ALLOW_EXTERNAL_RECIPIENT === '1'
  check('test recipient configured', Boolean(TEST_RECIPIENT), TEST_RECIPIENT)
  if (!recipientAllowed) {
    check('recipient safety gate', false, `Blocked external recipient ${TEST_RECIPIENT}`)
    throw new Error(
      'STOP: no approved test recipient. Set PHASE12_TEST_RECIPIENT to a TenderBriefing mailbox.'
    )
  }
  check('recipient safety gate', true, TEST_RECIPIENT)

  const auth = await getAdminIdToken()
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${auth.idToken}`,
  }

  // Create booking + simulate paid + approve report path
  const create = await fetchJson(`${BASE}/api/admin/manual-payments`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      companyName: 'Phase12 Delivery Cert SME',
      customerEmail: 'phase12-delivery-cert@tenderbriefing.test',
      contactPerson: 'Phase12 Cert',
      representedEntity: 'Phase12 Delivery Cert SME',
      briefings: [
        {
          tenderNumber: 'PHASE12-RFQ-CERT',
          tenderDescription: 'Phase 12 client delivery certification',
          procuringEntity: 'Certification Entity',
          briefingDate: '2099-07-01',
          briefingTime: '11:00',
          briefingVenue: 'Certification Venue',
          province: 'Gauteng',
        },
      ],
    }),
  })
  const booking = create.json?.data?.booking || {}
  const requestId = create.json?.data?.bookingId || booking.id
  check('booking created', Boolean(requestId), requestId)
  if (!requestId) throw new Error('No request id')

  const { getFirebaseAdmin } = require('../backend/config/firebaseAdmin')
  const db = getFirebaseAdmin().firestore()
  await db.collection('attendanceRequests').doc(requestId).set(
    {
      paymentStatus: 'paid',
      paidAt: new Date().toISOString(),
      paymentAmount: 75000,
      briefingPriceCents: 75000,
      opsStage: 'assignment_required',
      paymentCertificationNote: 'phase12_delivery_cert_simulated_no_payfast',
    },
    { merge: true }
  )
  check('simulated paid (no PayFast)', true)

  await fetchJson(`${BASE}/api/admin/ops/${requestId}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      action: 'assign',
      representativeName: 'Phase12 Rep',
      agentPayoutCents: 40000,
      internalNotes: 'PHASE12_INTERNAL_DO_NOT_LEAK',
    }),
  })
  await fetchJson(`${BASE}/api/admin/ops/${requestId}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'attend', note: 'Phase12 attendance' }),
  })
  await fetchJson(`${BASE}/api/admin/ops/${requestId}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'evidence_override', reason: 'phase12_cert' }),
  })

  const gen = await fetchJson(`${BASE}/api/admin/ops/${requestId}/report`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'generate' }),
  })
  check('generate draft', gen.json?.success === true)
  await fetchJson(`${BASE}/api/admin/ops/${requestId}/report`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      action: 'edit',
      edits: {
        sections: [
          {
            id: 'executive_brief',
            paragraphs: ['PHASE12_HUMAN_EDIT for delivery cert.'],
          },
        ],
      },
    }),
  })
  const approve = await fetchJson(`${BASE}/api/admin/ops/${requestId}/report`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'approve' }),
  })
  check('approve final (no auto email)', approve.json?.data?.emailSent === false, approve.json?.data?.emailSent)
  check(
    'report_ready',
    approve.json?.data?.row?.opsStage === 'report_ready',
    approve.json?.data?.row?.opsStage
  )
  const reportVersionId = approve.json?.data?.report?.id
  check('approved report version', Boolean(reportVersionId), reportVersionId)

  // IDOR
  const idor = await fetchJson(`${BASE}/api/admin/ops/${requestId}/delivery`)
  check('delivery IDOR blocked', idor.status === 401, idor.status)

  // Open review
  const open = await fetchJson(`${BASE}/api/admin/ops/${requestId}/delivery`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'open' }),
  })
  check('delivery review opened', open.json?.success === true)
  const deliveryId = open.json?.data?.delivery?.id
  check('deliveryId', Boolean(deliveryId), deliveryId)
  check(
    'status delivery_review',
    open.json?.data?.delivery?.status === 'delivery_review',
    open.json?.data?.delivery?.status
  )
  check(
    'PDF default selected',
    open.json?.data?.delivery?.attachPdf === true,
    String(open.json?.data?.delivery?.attachPdf)
  )

  // Edit recipient/subject/body + optional DOCX
  const update = await fetchJson(`${BASE}/api/admin/ops/${requestId}/delivery`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      action: 'update',
      deliveryId,
      patch: {
        to: TEST_RECIPIENT,
        cc: '',
        subject: `Tender Briefing Report — PHASE12-RFQ-CERT — Phase 12 client delivery certification`,
        body: `Dear Phase12 Cert,\n\nPlease find attached the Tender Briefing Report for PHASE12-RFQ-CERT.\n\nKind regards,\nTenderBriefing\nwww.tenderbriefing.co.za`,
        attachPdf: true,
        attachDocx: true,
      },
    }),
  })
  check('recipient/subject/body edit', update.json?.success === true)
  check(
    'recipient set',
    (update.json?.data?.delivery?.to || [])[0] === TEST_RECIPIENT.toLowerCase(),
    (update.json?.data?.delivery?.to || [])[0]
  )

  // Confirm gate without confirm=true
  const noConfirm = await fetchJson(`${BASE}/api/admin/ops/${requestId}/delivery`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'confirm_send', deliveryId, confirm: false }),
  })
  check('confirm gate blocks', noConfirm.status === 400 || noConfirm.json?.success === false)

  // Actual send
  const send = await fetchJson(`${BASE}/api/admin/ops/${requestId}/delivery`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'confirm_send', deliveryId, confirm: true }),
  })
  check('confirm & send', send.json?.success === true, send.json?.error)
  check('emailSent true', send.json?.data?.emailSent === true, send.json?.data?.emailSent)
  check(
    'provider message id',
    Boolean(send.json?.data?.providerMessageId || send.json?.data?.delivery?.providerMessageId),
    send.json?.data?.providerMessageId || send.json?.data?.delivery?.providerMessageId
  )
  check(
    'ops delivered',
    send.json?.data?.row?.opsStage === 'delivered',
    send.json?.data?.row?.opsStage
  )
  check(
    'attachments include pdf+docx',
    (send.json?.data?.delivery?.attachments || []).length >= 2,
    String((send.json?.data?.delivery?.attachments || []).length)
  )
  check(
    'locked report version',
    send.json?.data?.delivery?.reportVersionId === reportVersionId,
    send.json?.data?.delivery?.reportVersionId
  )

  // Idempotency
  const dup = await fetchJson(`${BASE}/api/admin/ops/${requestId}/delivery`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'confirm_send', deliveryId, confirm: true }),
  })
  check('duplicate blocked', dup.json?.data?.duplicate === true || dup.json?.data?.emailSent === false)

  const failed = checks.filter((c) => !c.ok)
  const report = {
    checks,
    paymentMade: false,
    realClientEmailed: false,
    testRecipient: TEST_RECIPIENT,
    bookingId: requestId,
    reportVersionId,
    deliveryId,
    verdict: failed.length === 0 ? 'PRODUCTION PASS' : 'HOLD',
    generatedAt: new Date().toISOString(),
    failures: failed.map((f) => f.name),
  }
  fs.writeFileSync(outJson, JSON.stringify(report, null, 2))
  console.log('\nWrote', outJson)
  console.log('VERDICT', report.verdict)
  if (failed.length) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  fs.writeFileSync(
    outJson,
    JSON.stringify(
      {
        checks,
        verdict: 'HOLD',
        error: err instanceof Error ? err.message : String(err),
        generatedAt: new Date().toISOString(),
      },
      null,
      2
    )
  )
  process.exit(1)
})
