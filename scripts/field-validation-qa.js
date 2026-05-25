#!/usr/bin/env node
/**
 * Phase 15 field validation — production-like E2E (no secrets in output).
 */
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const ROOT = path.join(__dirname, '..')
process.chdir(ROOT)
require('./load-env-local').loadEnvLocal()

const PROD_BASE =
  process.env.FIELD_VALIDATION_BASE ||
  process.env.PRODUCTION_URL ||
  'https://www.tenderbriefing.co.za'

const SME_EMAIL = 'ops-smoke-sme@tenderbriefing.co.za'
const AGENT_EMAIL = 'ops-smoke-agent@tenderbriefing.co.za'
const ADMIN_EMAIL = 'ops-smoke-admin@tenderbriefing.co.za'
const AGENT_UID = '36aQQWS3H9ZPITLYiluMQrwQv9r2'
const TEST_PASSWORD = process.env.SMOKE_TEST_PASSWORD || 'TenderBriefing_Smoke2026!'
const QA_TAG = 'phase15-field-validation'
const QA_LAT = -26.2041
const QA_LNG = 28.0473

const { getFirebaseAdmin } = require('../backend/config/firebaseAdmin')
const { ensureSmokeRoleProfiles } = require('./smoke-test-profiles')

const report = {
  label: 'Phase 15 Field Validation',
  productionUrl: PROD_BASE,
  checks: [],
  issues: [],
  passed: false,
}

function check(name, ok, detail = '') {
  report.checks.push({ name, ok, detail })
  if (!ok) report.issues.push(`${name}${detail ? `: ${detail}` : ''}`)
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
  return { status: res.status, json }
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
  if (!res.ok) throw new Error(data.error?.message || `signIn failed (${email})`)
  return data.idToken
}

function readAdminPassword() {
  const p = path.join(ROOT, '.qa-smoke-admin.txt')
  if (fs.existsSync(p)) {
    const line = fs.readFileSync(p, 'utf8').split('\n').find((l) => l.includes('@'))
    if (line) {
      const m = line.match(/password[:\s]+(\S+)/i)
      if (m) return m[1]
    }
  }
  return TEST_PASSWORD
}

async function markRequestPaid(requestId) {
  const db = getFirebaseAdmin().firestore()
  const now = new Date().toISOString()
  await db.collection('attendanceRequests').doc(requestId).update({
    paymentStatus: 'paid',
    paymentProvider: 'yoco',
    paymentAmount: 24900,
    currency: 'ZAR',
    paidAt: now,
    updatedAt: now,
    phase15FieldValidation: true,
  })
}

async function findTender(compulsoryList) {
  const gauteng = compulsoryList.filter(
    (t) =>
      (t.province || '').toLowerCase().includes('gauteng') &&
      t.briefingDate
  )
  const pool = gauteng.length ? gauteng : compulsoryList.filter((t) => t.briefingDate)
  pool.sort((a, b) => new Date(a.briefingDate) - new Date(b.briefingDate))
  const upcoming = pool.filter((t) => new Date(t.briefingDate) >= new Date())
  const pick = upcoming[0] || pool[0] || compulsoryList[0]
  const coords =
    pick.latitude != null && pick.longitude != null
      ? { lat: pick.latitude, lng: pick.longitude, source: 'tender_record' }
      : { lat: QA_LAT, lng: QA_LNG, source: 'qa_gauteng_center' }
  return {
    tenderId: pick.id,
    tenderNumber: pick.tenderNumber || pick.ocid,
    title: pick.title,
    department: pick.department,
    province: pick.province || 'Gauteng',
    briefingDate: pick.briefingDate,
    briefingVenue: pick.briefingVenue || 'QA venue — coordinates approximate',
    coordinates: coords,
  }
}

async function main() {
  const admin = getFirebaseAdmin()
  const db = admin.firestore()

  const smeRecord = await admin.auth().getUserByEmail(SME_EMAIL).catch(() => null)
  const agentRecord = await admin.auth().getUserByEmail(AGENT_EMAIL).catch(() => null)
  if (!smeRecord || !agentRecord) {
    throw new Error('Smoke SME or Agent auth user missing — run production-smoke-test first')
  }
  if (agentRecord.uid !== AGENT_UID) {
    report.agentUidNote = `Auth UID ${agentRecord.uid} differs from expected ${AGENT_UID}; using auth UID`
  }
  const agentUid = agentRecord.uid

  await ensureSmokeRoleProfiles(db, {
    uid: agentUid,
    email: AGENT_EMAIL,
    displayName: 'Smoke Test Agent',
    userType: 'youth-agent',
    extra: {
      province: 'Gauteng',
      city: 'Johannesburg',
      phoneNumber: '+27720708467',
      whatsAppNumber: '+27720708467',
      latitude: QA_LAT,
      longitude: QA_LNG,
    },
  })

  const smeToken = await getIdToken(SME_EMAIL, TEST_PASSWORD)
  const agentToken = await getIdToken(AGENT_EMAIL, TEST_PASSWORD)
  let adminToken = null
  try {
    adminToken = await getIdToken(ADMIN_EMAIL, readAdminPassword())
  } catch {
    report.adminAssignSkipped = 'ops-smoke-admin sign-in failed — will use agent accept'
  }

  const smeHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${smeToken}`,
  }
  const agentHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${agentToken}`,
  }
  const adminHeaders = adminToken
    ? { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }
    : null

  const tendersRes = await fetchJson(`${PROD_BASE}/api/tender-briefings`)
  check('load tenders', tendersRes.json.success)
  const compulsory = (tendersRes.json.data || []).filter((t) => t.briefingCompulsory)
  check('compulsory briefings exist', compulsory.length > 0, `count=${compulsory.length}`)

  report.tender = await findTender(compulsory)
  report.coordinatesNote =
    report.tender.coordinates.source === 'qa_gauteng_center'
      ? 'Using QA Gauteng center coordinates (no tender lat/lng on record)'
      : 'Using tender coordinates'

  const existingSnap = await db
    .collection('attendanceRequests')
    .where('smeId', '==', smeRecord.uid)
    .limit(50)
    .get()

  let requestId = null
  let requestDoc = null
  for (const doc of existingSnap.docs) {
    const d = doc.data()
    const tagged =
      d.phase15FieldValidation === true ||
      String(d.notes || '').includes(QA_TAG) ||
      String(d.smeNotes || '').includes(QA_TAG)
    if (
      tagged &&
      d.tenderId === report.tender.tenderId &&
      !['completed', 'cancelled'].includes(d.status)
    ) {
      requestId = doc.id
      requestDoc = { id: doc.id, ...d }
      break
    }
  }

  if (!requestId) {
    const createRes = await fetchJson(`${PROD_BASE}/api/attendance-requests`, {
      method: 'POST',
      headers: smeHeaders,
      body: JSON.stringify({
        tenderId: report.tender.tenderId,
        notes: `${QA_TAG} — automated field validation request`,
      }),
    })
    check('create attendance request', createRes.status === 200 || createRes.json.success)
    requestId =
      createRes.json.data?.request?.id ||
      createRes.json.data?.requestId ||
      createRes.json.data?.id
    if (!requestId) throw new Error('No requestId from create')
    await db.collection('attendanceRequests').doc(requestId).set(
      {
        phase15FieldValidation: true,
        qaCoordinates: report.tender.coordinates,
        briefingLatitude: report.tender.coordinates.lat,
        briefingLongitude: report.tender.coordinates.lng,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    )
    report.requestCreated = true
  } else {
    report.requestReused = true
  }

  report.requestId = requestId
  requestDoc = await db.collection('attendanceRequests').doc(requestId).get()
  requestDoc = requestDoc.exists ? { id: requestId, ...requestDoc.data() } : null

  if (requestDoc?.paymentStatus !== 'paid' && requestDoc?.paymentStatus !== 'not_required') {
    await markRequestPaid(requestId)
    report.paymentMarkedSmoke = true
  }

  if (requestDoc?.status === 'pending') {
    if (adminHeaders) {
      const assignRes = await fetchJson(
        `${PROD_BASE}/api/attendance-requests/${requestId}/assign`,
        {
          method: 'POST',
          headers: adminHeaders,
          body: JSON.stringify({
            agentId: agentUid,
            displayName: 'Smoke Test Agent',
          }),
        }
      )
      check('admin assign agent', assignRes.json.success, assignRes.json.error || String(assignRes.status))
      report.assignMethod = 'admin'
    } else {
      const acceptRes = await fetchJson(
        `${PROD_BASE}/api/attendance-requests/${requestId}/accept`,
        { method: 'POST', headers: agentHeaders }
      )
      check('agent accept (fallback)', acceptRes.json.success)
      report.assignMethod = 'agent_accept'
    }
  } else if (['assigned', 'accepted', 'in_progress'].includes(requestDoc?.status)) {
    check('request already assigned', requestDoc.assignedAgentId === agentUid || requestDoc.agentId === agentUid)
    report.assignMethod = 'reused_assigned'
  }

  requestDoc = (await db.collection('attendanceRequests').doc(requestId).get()).data()
  requestDoc = { id: requestId, ...requestDoc }
  report.assignedAgentId = requestDoc.assignedAgentId || requestDoc.agentId
  check('assignedAgentId set', report.assignedAgentId === agentUid)

  const workflowSnap = await db
    .collection('workflowEvents')
    .where('requestId', '==', requestId)
    .limit(5)
    .get()
    .catch(() => ({ docs: [] }))
  report.workflowEventsCount = workflowSnap.docs?.length || 0

  const dispatchSnap = await db.collection('dispatchEvents').limit(20).get()
  report.dispatchEventsForRequest = dispatchSnap.docs
    .filter((d) => d.data().requestId === requestId)
    .map((d) => d.id)

  const siteLat = requestDoc.briefingLatitude ?? report.tender.coordinates.lat
  const siteLng = requestDoc.briefingLongitude ?? report.tender.coordinates.lng
  const now = new Date().toISOString()

  const checkInRes = await fetchJson(`${PROD_BASE}/api/mobile/v1/check-in`, {
    method: 'POST',
    headers: agentHeaders,
    body: JSON.stringify({
      requestId,
      tenderId: report.tender.tenderId,
      latitude: siteLat,
      longitude: siteLng,
      siteLatitude: siteLat,
      siteLongitude: siteLng,
      deviceTimestamp: now,
      selfiePlaceholder: true,
      notes: QA_TAG,
      source: QA_TAG,
    }),
  })
  check('GPS check-in API', checkInRes.status === 200 && checkInRes.json.success, checkInRes.json.error)
  report.gpsCheckIn = checkInRes.json.data || null
  report.gpsCheckInId = report.gpsCheckIn?.id

  if (report.gpsCheckIn) {
    check('check-in within geofence', report.gpsCheckIn.withinGeofence === true, `distanceKm=${report.gpsCheckIn.distanceKm}`)
    if (report.gpsCheckIn.withinGeofence !== true) {
      report.geofenceNote = 'Coordinate mismatch — QA coords used; adjust siteLatitude/siteLongitude on request'
    }
  }

  const liveDispatchTracking = require('../backend/services/fieldOperations/liveDispatchTrackingService')
  await liveDispatchTracking.updateDispatchTracking({
    requestId,
    agentId: agentUid,
    status: 'checked_in',
    latitude: siteLat,
    longitude: siteLng,
    progressPct: 50,
  })

  const checkOutRes = await fetchJson(`${PROD_BASE}/api/mobile/v1/check-out`, {
    method: 'POST',
    headers: agentHeaders,
    body: JSON.stringify({
      requestId,
      tenderId: report.tender.tenderId,
      latitude: siteLat,
      longitude: siteLng,
      siteLatitude: siteLat,
      siteLongitude: siteLng,
      deviceTimestamp: new Date().toISOString(),
      notes: QA_TAG,
      source: QA_TAG,
    }),
  })
  check('GPS check-out API', checkOutRes.status === 200 && checkOutRes.json.success)
  report.gpsCheckOutId = checkOutRes.json.data?.id

  const gpsSnap = await db
    .collection('gpsAttendanceLogs')
    .where('requestId', '==', requestId)
    .where('agentId', '==', agentUid)
    .limit(10)
    .get()
  report.gpsLogIds = gpsSnap.docs.map((d) => d.id)
  check('gpsAttendanceLogs created', report.gpsLogIds.length >= 1, `count=${report.gpsLogIds.length}`)

  const attendanceValidation = require('../backend/services/fieldOperations/attendanceValidationService')
  const validation = await attendanceValidation.validateAttendance({
    agentId: agentUid,
    requestId,
    selfieUploaded: true,
  })
  report.fraudValidation = {
    valid: validation.valid,
    issues: validation.issues,
    alertCount: validation.fraudSignals?.alertCount,
  }
  check('attendance validation', validation.valid || validation.issues.length === 0, validation.issues.join(','))

  const fraudSnap = await db
    .collection('fraudAlerts')
    .where('agentId', '==', agentUid)
    .limit(15)
    .get()
  const recentFraud = fraudSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((f) => f.requestId === requestId || (f.createdAt && f.createdAt > new Date(Date.now() - 3600000).toISOString()))
  report.fraudAlertsForRun = recentFraud
  const highRisk = recentFraud.filter((f) => f.severity === 'critical' || f.severity === 'high')
  if (highRisk.length) {
    report.fraudNote = `Alerts logged (${highRisk.length}) — review if duplicate QA check-ins from prior runs`
    check('no unexpected high fraud', false, highRisk.map((f) => f.alertType).join(','))
  } else {
    check('fraud alerts acceptable', true, `recent=${recentFraud.length}`)
  }

  const reportBody = {
    requestId,
    tenderId: report.tender.tenderId,
    summary: `${QA_TAG}: Smoke Test Agent attended compulsory briefing. Key compliance and submission requirements captured.`,
    notes: `${QA_TAG} — briefing attended by Smoke Test Agent. Official channels only for final submission.`,
    attendanceConfirmed: true,
    keyInstructions: 'Bring CSD, tax clearance, and mandatory compliance documents.',
    submissionRequirements: 'Submit via official eTenders portal before closing date.',
    questionsAsked: 'Clarification on local content and B-BBEE thresholds.',
    risksClarifications: 'Late submission disqualifies; compulsory attendance verified.',
    attendanceProofUrl: 'https://www.tenderbriefing.co.za/phase15-qa-proof-placeholder.pdf',
    documentUrls: [],
    source: QA_TAG,
  }

  const reportRes = await fetchJson(`${PROD_BASE}/api/briefing-reports`, {
    method: 'POST',
    headers: agentHeaders,
    body: JSON.stringify(reportBody),
  })
  check('briefing report submit', reportRes.json.success, reportRes.json.error)
  report.briefingReportId = reportRes.json.data?.id

  const reqAfter = await db.collection('attendanceRequests').doc(requestId).get()
  report.requestStatusAfterReport = reqAfter.data()?.status
  check('request completed', reqAfter.data()?.status === 'completed')

  const briefingSummary = require('../backend/services/ai/briefingSummaryService')
  let aiInsight = null
  if (report.briefingReportId) {
    const reportDoc = await db.collection('briefingReports').doc(report.briefingReportId).get()
    if (reportDoc.exists) {
      aiInsight = await briefingSummary.summarizeBriefingReport({
        id: report.briefingReportId,
        ...reportDoc.data(),
      })
    }
  }
  check('AI briefing summary', Boolean(aiInsight?.narrativeSummary))
  report.aiBriefingInsightId = report.briefingReportId

  const aiDoc = await db.collection('aiBriefingInsights').doc(String(report.briefingReportId)).get()
  check('aiBriefingInsights persisted', aiDoc.exists)

  const payoutService = require('../backend/services/finance/payoutService')
  const payout = await payoutService.createPayoutBatch(agentUid, [requestId])
  report.payoutId = payout.id
  report.payoutAmountCents = payout.amountCents
  check('finance payout record (pending)', payout.status === 'pending' && payout.amountCents >= 0)

  const txSnap = await db
    .collection('financeTransactions')
    .where('payoutId', '==', payout.id)
    .limit(1)
    .get()
  report.financeTransactionId = txSnap.docs[0]?.id
  check('finance transaction linked', txSnap.docs.length === 1)

  const adminApis = {}
  if (adminToken) {
    for (const [name, url] of [
      ['dispatch', '/api/admin/dispatch'],
      ['fraud', '/api/admin/fraud'],
      ['finance', '/api/admin/finance'],
      ['ai-insights', '/api/admin/ai-insights'],
      ['agent-performance', '/api/admin/agents/performance'],
    ]) {
      const r = await fetchJson(`${PROD_BASE}${url}`, { headers: adminHeaders })
      adminApis[name] = { ok: r.json.success, status: r.status }
      check(`admin API ${name}`, r.json.success)
    }
  }

  report.adminApis = adminApis
  report.passed = report.issues.length === 0
  report.productionReadiness =
    report.passed && report.gpsCheckIn?.withinGeofence !== false
      ? 'ready'
      : report.passed
        ? 'ready_with_notes'
        : 'blocked'

  const safe = { ...report }
  delete safe.adminToken
  console.log(JSON.stringify(safe, null, 2))
  process.exit(report.passed ? 0 : 1)
}

main().catch((e) => {
  console.error(JSON.stringify({ error: e.message, checks: report.checks }, null, 2))
  process.exit(1)
})
