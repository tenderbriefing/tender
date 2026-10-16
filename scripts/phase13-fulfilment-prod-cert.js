#!/usr/bin/env node
/**
 * Phase 13 controlled production certification.
 * Simulated paid only — no PayFast. Founder/test mailbox only.
 */
const fs = require('fs')
const path = require('path')

require('./load-env-local').loadEnvLocal()
process.env.GOOGLE_APPLICATION_CREDENTIALS = path.resolve('service-account.json')
process.env.STORAGE_ADAPTER = 'firestore'
process.env.FIREBASE_PROJECT_ID =
  process.env.FIREBASE_PROJECT_ID || 'tenderbriefing-34679'

const BASE = process.env.PHASE13_CERT_BASE || 'https://www.tenderbriefing.co.za'
const ADMIN_EMAIL = process.env.FOUNDER_ADMIN_EMAIL || 'info@tenderbriefing.co.za'
const TEST_RECIPIENT =
  process.env.PHASE13_TEST_RECIPIENT ||
  process.env.PHASE12_TEST_RECIPIENT ||
  process.env.FOUNDER_EMAIL_ALLOWLIST?.split(',')[0]?.trim() ||
  ADMIN_EMAIL

const outJson = path.resolve('tmp-phase13-fulfilment-prod-cert.json')
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
    process.env.PHASE13_ALLOW_EXTERNAL_RECIPIENT === '1'
  check('test recipient configured', Boolean(TEST_RECIPIENT), TEST_RECIPIENT)
  if (!recipientAllowed) {
    check('recipient safety gate', false, `Blocked external recipient ${TEST_RECIPIENT}`)
    throw new Error('STOP: no approved test recipient for Phase 13')
  }
  check('recipient safety gate', true, TEST_RECIPIENT)

  const auth = await getAdminIdToken()
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${auth.idToken}`,
  }

  const create = await fetchJson(`${BASE}/api/admin/manual-payments`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      companyName: 'Phase13 Fulfilment Cert SME',
      customerEmail: 'phase13-fulfilment-cert@tenderbriefing.test',
      contactPerson: 'Phase13 Cert',
      representedEntity: 'Phase13 Fulfilment Cert SME',
      briefings: [
        {
          tenderNumber: 'PHASE13-RFQ-CERT',
          tenderDescription: 'Phase 13 fulfilment closure certification',
          procuringEntity: 'Certification Entity',
          briefingDate: '2099-09-01',
          briefingTime: '10:00',
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
      paymentCertificationNote: 'phase13_fulfilment_cert_simulated_no_payfast',
    },
    { merge: true }
  )
  check('simulated paid (no PayFast)', true)

  // Exception path A: unassigned approaching — temporarily backdate briefing
  const pastBriefing = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
  const pastDate = pastBriefing.toISOString().slice(0, 10)
  await db.collection('attendanceRequests').doc(requestId).set(
    { briefingDate: pastDate, briefingTime: '09:00' },
    { merge: true }
  )
  let board = await fetchJson(`${BASE}/api/admin/ops/board?filter=needs_attention`, {
    headers: { Authorization: headers.Authorization },
  })
  const unassignedHit = (board.json?.data?.exceptions || board.json?.data?.rows || []).find(
    (r) => r.id === requestId && r.exceptionCode === 'UNASSIGNED_APPROACHING_BRIEFING'
  )
  const missingEvidencePrep = (board.json?.data?.exceptions || []).some(
    (r) => r.exceptionCode === 'BRIEFING_PASSED_NO_EVIDENCE' || r.exceptionCode === 'UNASSIGNED_APPROACHING_BRIEFING'
  )
  check(
    'exception queue surfaces unassigned/overdue after briefing window',
    Boolean(unassignedHit) || missingEvidencePrep,
    unassignedHit?.exceptionCode || board.json?.data?.exceptions?.[0]?.exceptionCode
  )

  // Restore future briefing for happy path
  await db.collection('attendanceRequests').doc(requestId).set(
    { briefingDate: '2099-09-01', briefingTime: '10:00' },
    { merge: true }
  )

  await fetchJson(`${BASE}/api/admin/ops/${requestId}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      action: 'assign',
      representativeName: 'Phase13 Rep',
      agentPayoutCents: 40000,
      internalNotes: 'PHASE13_INTERNAL_DO_NOT_LEAK',
    }),
  })
  await fetchJson(`${BASE}/api/admin/ops/${requestId}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'attend', note: 'Phase13 attendance' }),
  })
  await fetchJson(`${BASE}/api/admin/ops/${requestId}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'evidence_override', reason: 'phase13_cert' }),
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
            paragraphs: ['PHASE13_HUMAN_EDIT for fulfilment cert.'],
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
  check('approve final', approve.json?.success === true)
  const reportVersionId = approve.json?.data?.report?.id
  check('approved report version', Boolean(reportVersionId), reportVersionId)

  // IDOR
  const idorBoard = await fetchJson(`${BASE}/api/admin/ops/board`)
  check('board IDOR blocked', idorBoard.status === 401, idorBoard.status)
  const idorComplete = await fetchJson(`${BASE}/api/admin/ops/${requestId}`, {
    method: 'POST',
    body: JSON.stringify({ action: 'complete' }),
  })
  check('complete IDOR blocked', idorComplete.status === 401, idorComplete.status)
  const idorReopen = await fetchJson(`${BASE}/api/admin/ops/${requestId}`, {
    method: 'POST',
    body: JSON.stringify({
      action: 'reopen',
      confirm: true,
      reason: 'Need correction for site notes',
    }),
  })
  check('reopen IDOR blocked', idorReopen.status === 401, idorReopen.status)

  const open = await fetchJson(`${BASE}/api/admin/ops/${requestId}/delivery`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'open' }),
  })
  const deliveryId = open.json?.data?.delivery?.id
  check('delivery review opened', Boolean(deliveryId), deliveryId)

  await fetchJson(`${BASE}/api/admin/ops/${requestId}/delivery`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      action: 'update',
      deliveryId,
      toEmail: TEST_RECIPIENT,
      subject: 'Phase 13 fulfilment cert — TenderBriefing report',
    }),
  })

  const send = await fetchJson(`${BASE}/api/admin/ops/${requestId}/delivery`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'confirm_send', deliveryId, confirm: true }),
  })
  check('confirm & send', send.json?.success === true, send.json?.error)
  check('no uncontrolled customer email', send.json?.data?.delivery?.toEmail === TEST_RECIPIENT, send.json?.data?.delivery?.toEmail)

  const complete = await fetchJson(`${BASE}/api/admin/ops/${requestId}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'complete' }),
  })
  check('COMPLETED transition', complete.json?.success === true, complete.json?.error)
  check(
    'completion metadata',
    Boolean(complete.json?.data?.result?.request?.completedAt) &&
      Boolean(complete.json?.data?.result?.request?.finalReportVersionId) &&
      Boolean(complete.json?.data?.result?.request?.finalDeliveryId),
    JSON.stringify({
      completedAt: complete.json?.data?.result?.request?.completedAt,
      finalReportVersionId: complete.json?.data?.result?.request?.finalReportVersionId,
      finalDeliveryId: complete.json?.data?.result?.request?.finalDeliveryId,
    })
  )
  check(
    'ops stage completed',
    complete.json?.data?.row?.opsStage === 'completed',
    complete.json?.data?.row?.opsStage
  )

  const reopenReject = await fetchJson(`${BASE}/api/admin/ops/${requestId}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'reopen', confirm: true, reason: 'short' }),
  })
  check(
    'mandatory reopen reason',
    reopenReject.status === 400 || reopenReject.json?.success === false,
    reopenReject.json?.error
  )

  const reopen = await fetchJson(`${BASE}/api/admin/ops/${requestId}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      action: 'reopen',
      confirm: true,
      reason: 'Need corrected venue observation for Phase 13 cert',
    }),
  })
  check('reopen for correction', reopen.json?.success === true, reopen.json?.error)
  const newVersion = reopen.json?.data?.result?.report?.id
  const priorVersion = reopen.json?.data?.result?.priorReportVersionId
  check('new correction version', Boolean(newVersion) && newVersion !== priorVersion, newVersion)
  check('historical version preserved id', priorVersion === reportVersionId, priorVersion)

  // Privacy: board row must not expose internal notes string
  const boardDone = await fetchJson(`${BASE}/api/admin/ops/board?filter=in_progress`, {
    headers: { Authorization: headers.Authorization },
  })
  const privacyLeak = JSON.stringify(boardDone.json || {}).includes('PHASE13_INTERNAL_DO_NOT_LEAK')
  check('internal notes not in board payload', !privacyLeak)

  // Controlled exception path: missing evidence on a second synthetic record
  const create2 = await fetchJson(`${BASE}/api/admin/manual-payments`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      companyName: 'Phase13 Exception Cert SME',
      customerEmail: 'phase13-exception-cert@tenderbriefing.test',
      contactPerson: 'Phase13 Ex',
      briefings: [
        {
          tenderNumber: 'PHASE13-EXC-CERT',
          tenderDescription: 'Phase 13 missing-evidence exception',
          briefingDate: pastDate,
          briefingTime: '08:00',
          briefingVenue: 'Exception Venue',
          province: 'Gauteng',
        },
      ],
    }),
  })
  const excId = create2.json?.data?.bookingId || create2.json?.data?.booking?.id
  await db.collection('attendanceRequests').doc(excId).set(
    {
      paymentStatus: 'paid',
      paidAt: new Date().toISOString(),
      paymentAmount: 75000,
      briefingPriceCents: 75000,
      opsStage: 'assignment_required',
      briefingDate: pastDate,
      briefingTime: '08:00',
      paymentCertificationNote: 'phase13_exception_cert_simulated_no_payfast',
    },
    { merge: true }
  )
  await fetchJson(`${BASE}/api/admin/ops/${excId}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      action: 'assign',
      representativeName: 'Phase13 Exc Rep',
      agentPayoutCents: 35000,
    }),
  })
  await fetchJson(`${BASE}/api/admin/ops/${excId}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'attend', note: 'attended awaiting evidence' }),
  })

  board = await fetchJson(`${BASE}/api/admin/ops/board?filter=needs_attention`, {
    headers: { Authorization: headers.Authorization },
  })
  const missingEvidence = (board.json?.data?.exceptions || board.json?.data?.rows || []).find(
    (r) => r.id === excId && r.exceptionCode === 'BRIEFING_PASSED_NO_EVIDENCE'
  )
  check(
    'missing-evidence exception',
    Boolean(missingEvidence),
    missingEvidence?.exceptionCode || missingEvidence?.nextAction
  )
  check(
    'recovery action present',
    Boolean(missingEvidence?.nextAction),
    missingEvidence?.nextAction
  )

  // Filters
  for (const f of [
    'needs_attention',
    'due_soon',
    'overdue',
    'in_progress',
    'ready_to_send',
    'delivery_issue',
    'completed',
  ]) {
    const fr = await fetchJson(`${BASE}/api/admin/ops/board?filter=${f}`, {
      headers: { Authorization: headers.Authorization },
    })
    check(`filter ${f}`, fr.json?.success === true, `rows=${(fr.json?.data?.rows || []).length}`)
  }

  const failed = checks.filter((c) => !c.ok)
  const report = {
    phase: 13,
    requestId,
    exceptionRequestId: excId,
    reportVersionId,
    correctionVersionId: newVersion,
    priorReportVersionId: priorVersion,
    deliveryId,
    testRecipient: TEST_RECIPIENT,
    base: BASE,
    checks,
    pass: failed.length === 0,
    noPayFast: true,
    controlledEmailOnly: true,
    at: new Date().toISOString(),
  }
  fs.writeFileSync(outJson, JSON.stringify(report, null, 2))
  console.log(`\nWrote ${outJson}`)
  console.log(failed.length === 0 ? 'PHASE 13 CERT: PASS' : `PHASE 13 CERT: FAIL (${failed.length})`)
  if (failed.length) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  fs.writeFileSync(
    outJson,
    JSON.stringify({ pass: false, error: String(err?.message || err) }, null, 2)
  )
  process.exit(1)
})
