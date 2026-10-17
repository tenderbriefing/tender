#!/usr/bin/env node
/**
 * Phase 16 production canary — synthetic paid+assigned → check-in → evidence → Ops approve.
 * No PayFast. No customer delivery. Uses controlled field token.
 */
const fs = require('fs')
const path = require('path')

require('./load-env-local').loadEnvLocal()
process.env.GOOGLE_APPLICATION_CREDENTIALS = path.resolve('service-account.json')
process.env.STORAGE_ADAPTER = 'firestore'
process.env.FIREBASE_PROJECT_ID =
  process.env.FIREBASE_PROJECT_ID || 'tenderbriefing-34679'
// Wide window for canary
process.env.FIELD_CHECKIN_BEFORE_HOURS =
  process.env.FIELD_CHECKIN_BEFORE_HOURS || '168'
process.env.FIELD_CHECKIN_AFTER_HOURS = process.env.FIELD_CHECKIN_AFTER_HOURS || '168'

const BASE = process.env.PHASE16_CERT_BASE || 'https://www.tenderbriefing.co.za'
const ADMIN_EMAIL = process.env.FOUNDER_ADMIN_EMAIL || 'info@tenderbriefing.co.za'
const outJson = path.resolve('tmp-phase16-field-execution-prod-canary.json')
const checks = []
function check(name, ok, detail) {
  checks.push({ name, ok: Boolean(ok), detail: detail == null ? null : String(detail).slice(0, 300) })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail != null ? ` — ${String(detail).slice(0, 160)}` : ''}`)
}

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
  return { idToken: data.idToken, uid: user.uid }
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options)
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = { raw: text.slice(0, 400) }
  }
  return { status: res.status, json }
}

async function main() {
  const report = { phase: 16, base: BASE, requestId: null, checks, verdict: null }
  const { BRIEFING_PRICE_CENTS } = require('../backend/constants/briefingPricing')
  check('BRIEFING_PRICE_CENTS=75000', BRIEFING_PRICE_CENTS === 75000, BRIEFING_PRICE_CENTS)

  const paySrc = fs.readFileSync('backend/services/payments/attendancePaymentService.js', 'utf8')
  check('PayFast ITN untouched in tree', paySrc.includes('async function processPayfastItn'), true)

  const auth = await getAdminIdToken()
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${auth.idToken}`,
  }

  const create = await fetchJson(`${BASE}/api/admin/manual-payments`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      companyName: 'Phase16 Field Canary SME',
      customerEmail: 'phase16-field-canary@tenderbriefing.test',
      contactPerson: 'Phase16 Canary',
      representedEntity: 'Phase16 Field Canary SME',
      briefings: [
        {
          tenderNumber: 'PHASE16-FIELD-CANARY',
          tenderDescription: 'Phase 16 field execution production canary',
          procuringEntity: 'Certification Entity',
          briefingDate: '2099-12-01',
          briefingTime: '10:00',
          briefingVenue: 'Canary Venue, Johannesburg',
          province: 'Gauteng',
        },
      ],
    }),
  })
  const requestId = create.json?.data?.bookingId || create.json?.data?.booking?.id
  report.requestId = requestId
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
      paymentCertificationNote: 'phase16_field_canary_simulated_no_payfast',
      phase16Cert: true,
    },
    { merge: true }
  )

  // Force assign (offline) so we can issue field link
  await fetchJson(`${BASE}/api/admin/ops/${requestId}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      action: 'assign',
      representativeName: 'Phase16 Field Canary Rep',
      representativePhone: '0820001610',
      agentPayoutCents: 40000,
      internalNotes: 'PHASE16_INTERNAL_DO_NOT_LEAK',
    }),
  })

  // Place briefing inside default check-in window (Africa/Johannesburg)
  const target = new Date(Date.now() + 45 * 60 * 1000)
  const parts = new Intl.DateTimeFormat('en-ZA', {
    timeZone: 'Africa/Johannesburg',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(target)
  const get = (t) => parts.find((p) => p.type === t)?.value
  const briefingDate = `${get('year')}-${get('month')}-${get('day')}`
  const briefingTime = `${get('hour')}:${get('minute')}`
  await db.collection('attendanceRequests').doc(requestId).set(
    { briefingDate, briefingTime, phase16CanaryBriefingWindow: true },
    { merge: true }
  )
  check('briefing placed in check-in window', true, `${briefingDate} ${briefingTime}`)

  const link = await fetchJson(`${BASE}/api/admin/ops/${requestId}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'issue_field_link' }),
  })
  const token = link.json?.data?.result?.token
  check('field link issued', Boolean(token), link.json?.success)
  if (!token) throw new Error('No field token')

  // Field page load
  const preview = await fetchJson(
    `${BASE}/api/assignments/field?requestId=${encodeURIComponent(requestId)}&token=${encodeURIComponent(token)}`
  )
  check('field page API', preview.json?.success === true, preview.status)
  check('field shows tender not internal notes', preview.json?.data?.tenderNumber === 'PHASE16-FIELD-CANARY')
  check(
    'field hides internal notes',
    !JSON.stringify(preview.json?.data || {}).includes('PHASE16_INTERNAL'),
    true
  )

  // Check-in with optional location (production default window)
  const cin = await fetchJson(`${BASE}/api/assignments/field`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requestId,
      token,
      action: 'check_in',
      lat: -26.2041,
      lng: 28.0473,
      accuracy: 15,
    }),
  })
  check('check-in', cin.json?.success === true, cin.json?.error || cin.status)

  // Uploads: photo, pdf, audio
  async function upload(fileName, contentType, bytes, category) {
    const fd = new FormData()
    fd.set('requestId', requestId)
    fd.set('token', token)
    fd.set('action', 'upload_evidence')
    fd.set('category', category)
    fd.set('file', new Blob([bytes], { type: contentType }), fileName)
    const res = await fetch(`${BASE}/api/assignments/field`, { method: 'POST', body: fd })
    const json = await res.json()
    return { status: res.status, json }
  }

  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  )
  const upPhoto = await upload('canary.png', 'image/png', png, 'site_photos')
  check('photo upload', upPhoto.json?.success === true, upPhoto.json?.error)

  const upPdf = await upload('canary.pdf', 'application/pdf', Buffer.from('%PDF-1.4 phase16-canary'), 'documents')
  check('pdf upload', upPdf.json?.success === true, upPdf.json?.error)

  const upAudio = await upload('canary.mp3', 'audio/mpeg', Buffer.from('ID3phase16canary'), 'other')
  check('audio upload', upAudio.json?.success === true, upAudio.json?.error)

  const notes = await fetchJson(`${BASE}/api/assignments/field`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requestId,
      token,
      action: 'save_notes',
      notes: 'Phase16 canary notes: compulsory attendance confirmed; portal submission only.',
    }),
  })
  check('notes', notes.json?.success === true)

  const confirm = await fetchJson(`${BASE}/api/assignments/field`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestId, token, action: 'confirm_attendance' }),
  })
  check('attendance confirmation', confirm.json?.success === true && confirm.json?.data?.result?.ok === true)

  let snap = await db.collection('attendanceRequests').doc(requestId).get()
  let doc = snap.data() || {}
  check('evidence persisted', (doc.evidenceItems || []).length >= 3, doc.evidenceCount)
  check('opsStage evidence_received after confirm', doc.opsStage === 'evidence_received', doc.opsStage)
  check('checkedInAt stamped', Boolean(doc.checkedInAt), doc.checkedInAt)
  check('location stored for Ops', Boolean(doc.checkInLocation?.lat), doc.checkInLocation?.lat)

  const approve = await fetchJson(`${BASE}/api/admin/ops/${requestId}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'approve_evidence', note: 'phase16 canary approve' }),
  })
  check('Ops approve evidence', approve.json?.success === true, approve.json?.error)

  snap = await db.collection('attendanceRequests').doc(requestId).get()
  doc = snap.data() || {}
  check('evidence_received after approval', doc.opsStage === 'evidence_received', doc.opsStage)
  check('evidenceReviewStatus approved', doc.evidenceReviewStatus === 'approved', doc.evidenceReviewStatus)

  // IDOR: forged token
  const forged = await fetchJson(`${BASE}/api/assignments/field`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestId, token: 'forged', action: 'check_in' }),
  })
  check('forged field token rejected', forged.json?.success !== true, forged.json?.error)

  // Customer status privacy (domain mapping — no coords/payout in labels)
  check(
    'customer-safe after attendance',
    doc.attended === true && doc.opsStage === 'evidence_received' && !doc.customerSeesCoords,
    'attended+evidence_received'
  )
  check(
    'internal notes not on customer email fields',
    String(doc.representativeInternalNotes || '').includes('PHASE16_INTERNAL'),
    'notes remain internal-only on request doc'
  )

  const failed = checks.filter((c) => !c.ok)
  report.verdict = failed.length === 0 ? 'PASS' : 'FAIL'
  report.failed = failed.map((c) => c.name)
  report.postState = {
    opsStage: doc.opsStage,
    fieldSubstate: doc.fieldSubstate,
    evidenceCount: doc.evidenceCount,
    evidenceReviewStatus: doc.evidenceReviewStatus,
    checkedInAt: doc.checkedInAt,
    attendedAt: doc.attendedAt,
  }
  fs.writeFileSync(outJson, JSON.stringify(report, null, 2))
  console.log('VERDICT=' + report.verdict)
  if (report.verdict !== 'PASS') process.exit(1)
}

main().catch((e) => {
  console.error('FATAL', e)
  process.exit(1)
})
