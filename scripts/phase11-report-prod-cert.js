#!/usr/bin/env node
/**
 * Phase 11 production certification (non-chargeable).
 * Flow: create booking → simulate paid → assign → attend → evidence →
 * generate draft → edit → approve → REPORT READY.
 * STOP at REPORT READY. No email. No PayFast charge. No mark delivered.
 */
const fs = require('fs')
const path = require('path')

require('./load-env-local').loadEnvLocal()
process.env.GOOGLE_APPLICATION_CREDENTIALS = path.resolve('service-account.json')
process.env.STORAGE_ADAPTER = 'firestore'
process.env.FIREBASE_PROJECT_ID =
  process.env.FIREBASE_PROJECT_ID || 'tenderbriefing-34679'

const BASE = process.env.PHASE11_CERT_BASE || 'https://www.tenderbriefing.co.za'
const ADMIN_EMAIL = process.env.FOUNDER_ADMIN_EMAIL || 'info@tenderbriefing.co.za'
const outJson = path.resolve('tmp-phase11-report-prod-cert.json')

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
  return { status: res.status, json, headers: res.headers, text }
}

async function main() {
  const { BRIEFING_PRICE_CENTS } = require('../backend/constants/briefingPricing')
  check('BRIEFING_PRICE_CENTS=75000', BRIEFING_PRICE_CENTS === 75000, BRIEFING_PRICE_CENTS)

  const auth = await getAdminIdToken()
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${auth.idToken}`,
  }
  console.log('AUTH_OK', { uid: auth.uid, email: auth.email, base: BASE })

  // Create non-chargeable manual booking
  const create = await fetchJson(`${BASE}/api/admin/manual-payment-requests`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      companyName: 'Phase11 Report Cert SME',
      customerEmail: 'phase11-report-cert@tenderbriefing.test',
      contactPerson: 'Phase11 Cert',
      representedEntity: 'Ingenuity Engineers & Constructors',
      briefings: [
        {
          tenderNumber: 'PHASE11-RFQ-CERT',
          tenderDescription: 'Phase 11 report production certification briefing',
          procuringEntity: 'Certification Procuring Entity',
          briefingDate: '2099-06-15',
          briefingTime: '10:00',
          briefingVenue: 'Certification Venue, Pretoria',
          province: 'Gauteng',
        },
      ],
    }),
  })
  check('create manual HTTP 200', create.status === 200, create.status)
  const requestId = create.json?.data?.request?.id || create.json?.data?.id
  check('booking created', Boolean(requestId), requestId)
  if (!requestId) throw new Error('No request id')

  // Simulate paid WITHOUT PayFast
  const { getFirebaseAdmin } = require('../backend/config/firebaseAdmin')
  const db = getFirebaseAdmin().firestore()
  const ref = db.collection('attendanceRequests').doc(requestId)
  await ref.set(
    {
      paymentStatus: 'paid',
      paidAt: new Date().toISOString(),
      paymentAmount: 75000,
      briefingPriceCents: 75000,
      opsStage: 'assignment_required',
      availableForAssignment: true,
      paymentCertificationNote: 'phase11_report_cert_simulated_no_payfast',
    },
    { merge: true }
  )
  check('simulated paid (no PayFast)', true, 'phase11_report_cert_simulated')

  // Assign
  const assign = await fetchJson(`${BASE}/api/admin/ops/${requestId}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      action: 'assign',
      representativeName: 'Phase11 Field Rep',
      representativePhone: '+27820000011',
      agentPayoutCents: 40000,
      internalNotes: 'PHASE11_INTERNAL_NOTE_DO_NOT_LEAK',
    }),
  })
  check('assign', assign.status === 200 && assign.json?.success, assign.json?.error || assign.status)

  // Attend
  const attend = await fetchJson(`${BASE}/api/admin/ops/${requestId}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      action: 'attend',
      note: 'Certification attendance confirmed on site.',
    }),
  })
  check('attend', attend.status === 200 && attend.json?.success, attend.json?.data?.row?.opsStage)

  // Evidence override (non-chargeable path; optional upload)
  const evidence = await fetchJson(`${BASE}/api/admin/ops/${requestId}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      action: 'evidence_override',
      reason: 'phase11_cert_sparse_evidence_path',
    }),
  })
  check(
    'evidence_received',
    evidence.json?.data?.row?.opsStage === 'evidence_received',
    evidence.json?.data?.row?.opsStage
  )

  // IDOR: no auth on report
  const idor = await fetchJson(`${BASE}/api/admin/ops/${requestId}/report`)
  check('report IDOR blocked (no auth)', idor.status === 401, idor.status)

  // Generate draft
  const gen = await fetchJson(`${BASE}/api/admin/ops/${requestId}/report`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'generate' }),
  })
  check('generate draft', gen.status === 200 && gen.json?.success, gen.json?.error || gen.status)
  check(
    'report_in_progress',
    gen.json?.data?.row?.opsStage === 'report_in_progress',
    gen.json?.data?.row?.opsStage
  )
  const draftVoice = gen.json?.data?.report?.draft?.voice
  check('third-person voice', draftVoice === 'third_person', draftVoice)
  const draftBlob = JSON.stringify(gen.json?.data?.report?.draft || {})
  check('no internal payout leak', !/40000|PHASE11_INTERNAL|agentPayoutCents/.test(draftBlob), 'ok')

  // Edit one section
  const edit = await fetchJson(`${BASE}/api/admin/ops/${requestId}/report`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      action: 'edit',
      edits: {
        sections: [
          {
            id: 'executive_brief',
            title: 'Executive Brief',
            paragraphs: [
              'PHASE11_HUMAN_EDIT — certification edit must persist through approval.',
            ],
          },
        ],
      },
    }),
  })
  check('edit persists', edit.status === 200 && edit.json?.success, edit.json?.error)
  const editedPara =
    edit.json?.data?.report?.draft?.sections?.find((s) => s.id === 'executive_brief')
      ?.paragraphs?.[0] || ''
  check('human edit text present', /PHASE11_HUMAN_EDIT/.test(editedPara), editedPara.slice(0, 80))

  // Approve final — must not email
  const approve = await fetchJson(`${BASE}/api/admin/ops/${requestId}/report`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'approve' }),
  })
  check('approve final', approve.status === 200 && approve.json?.success, approve.json?.error)
  check('emailSent=false', approve.json?.data?.emailSent === false, approve.json?.data?.emailSent)
  check(
    'REPORT READY',
    approve.json?.data?.row?.opsStage === 'report_ready',
    approve.json?.data?.row?.opsStage
  )
  const stillEdited =
    approve.json?.data?.report?.draft?.sections?.find((s) => s.id === 'executive_brief')
      ?.paragraphs?.[0] || ''
  check('edit survived approval', /PHASE11_HUMAN_EDIT/.test(stillEdited), stillEdited.slice(0, 80))

  // Download PDF + DOCX
  const pdf = await fetch(`${BASE}/api/admin/ops/${requestId}/report/download?format=pdf`, {
    headers: { Authorization: `Bearer ${auth.idToken}` },
  })
  const pdfBuf = Buffer.from(await pdf.arrayBuffer())
  const pdfOk =
    pdf.status === 200 &&
    (pdfBuf.slice(0, 4).toString() === '%PDF' ||
      (await pdf.clone?.().json?.().catch?.(async () => null)))
  // If JSON signed URL mode:
  let pdfResult = 'buffer'
  if (pdf.headers.get('content-type')?.includes('json')) {
    const j = JSON.parse(pdfBuf.toString('utf8'))
    check('pdf signed url', Boolean(j?.data?.url), j?.error)
    pdfResult = 'url'
    if (j?.data?.url) {
      const pr = await fetch(j.data.url)
      const pb = Buffer.from(await pr.arrayBuffer())
      check('pdf magic', pb.slice(0, 4).toString() === '%PDF', pb.slice(0, 4).toString())
      fs.writeFileSync(path.resolve('tmp-phase11-report-prod-cert.pdf'), pb)
    }
  } else {
    check('pdf magic', pdfBuf.slice(0, 4).toString() === '%PDF', pdfBuf.slice(0, 4).toString())
    fs.writeFileSync(path.resolve('tmp-phase11-report-prod-cert.pdf'), pdfBuf)
  }

  const docxRes = await fetch(`${BASE}/api/admin/ops/${requestId}/report/download?format=docx`, {
    headers: { Authorization: `Bearer ${auth.idToken}` },
  })
  const docxBuf = Buffer.from(await docxRes.arrayBuffer())
  if (docxRes.headers.get('content-type')?.includes('json')) {
    const j = JSON.parse(docxBuf.toString('utf8'))
    check('docx signed url', Boolean(j?.data?.url), j?.error)
    if (j?.data?.url) {
      const dr = await fetch(j.data.url)
      const dbuf = Buffer.from(await dr.arrayBuffer())
      check('docx zip magic', dbuf[0] === 0x50 && dbuf[1] === 0x4b, `${dbuf[0]},${dbuf[1]}`)
      fs.writeFileSync(path.resolve('tmp-phase11-report-prod-cert.docx'), dbuf)
    }
  } else {
    check('docx zip magic', docxBuf[0] === 0x50 && docxBuf[1] === 0x4b, `${docxBuf[0]},${docxBuf[1]}`)
    fs.writeFileSync(path.resolve('tmp-phase11-report-prod-cert.docx'), docxBuf)
  }

  // Confirm still not delivered
  const board = await fetchJson(`${BASE}/api/admin/ops/board?limit=100`, { headers })
  const row = (board.json?.data?.rows || []).find((r) => r.id === requestId)
  check('board shows report_ready', row?.opsStage === 'report_ready', row?.opsStage)
  check('not delivered', !row?.deliveredAt, row?.deliveredAt || 'none')

  const failed = checks.filter((c) => !c.ok)
  const report = {
    checks,
    emailSent: false,
    paymentMade: false,
    bookingId: requestId,
    pdfResult,
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
  const report = {
    checks,
    emailSent: false,
    paymentMade: false,
    verdict: 'HOLD',
    error: err instanceof Error ? err.message : String(err),
    generatedAt: new Date().toISOString(),
  }
  fs.writeFileSync(outJson, JSON.stringify(report, null, 2))
  process.exit(1)
})
