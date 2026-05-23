#!/usr/bin/env node
/**
 * Production operational workflow smoke test (TenderBriefing).
 * Uses Firebase Admin + production API — does not log secrets or passwords.
 */
const path = require('path')
process.chdir(path.join(__dirname, '..'))
require('./load-env-local').loadEnvLocal()

const PROD_BASE = 'https://tenderbriefing-xzgs5uw5ta-bq.a.run.app'
const SME_EMAIL = 'ops-smoke-sme@tenderbriefing.co.za'
const AGENT_EMAIL = 'ops-smoke-agent@tenderbriefing.co.za'
const TEST_PASSWORD = process.env.SMOKE_TEST_PASSWORD || 'TenderBriefing_Smoke2026!'

const { getFirebaseAdmin } = require('../backend/config/firebaseAdmin')
const { sanitizeFirestoreData } = require('../backend/utils/sanitizeFirestoreData')

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options)
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = { raw: text.slice(0, 200) }
  }
  return { status: res.status, json }
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
  if (!res.ok) {
    throw new Error(data.error?.message || `signIn failed (${res.status})`)
  }
  return { idToken: data.idToken, localId: data.localId }
}

async function ensureUser({ email, password, displayName, userType, extra = {} }) {
  const admin = getFirebaseAdmin()
  const db = admin.firestore()
  let uid

  try {
    const existing = await admin.auth().getUserByEmail(email)
    uid = existing.uid
    await admin.auth().updateUser(uid, { password, displayName })
  } catch (e) {
    if (e.code !== 'auth/user-not-found') throw e
    const created = await admin.auth().createUser({
      email,
      password,
      displayName,
      emailVerified: true,
    })
    uid = created.uid
  }

  const profile = sanitizeFirestoreData({
    uid,
    email,
    displayName,
    userType,
    phoneNumber: '+27000000000',
    location: extra.location || 'Gauteng',
    province: extra.location || 'Gauteng',
    rating: userType === 'youth-agent' ? 4 : undefined,
    availability: userType === 'youth-agent' ? 'available' : undefined,
    verified: true,
    missedMeetings: 0,
    categories: userType === 'sme' ? extra.categories || ['General'] : [],
    companyName: userType === 'sme' ? extra.companyName || 'Smoke Test SME (Pty) Ltd' : '',
    skills: userType === 'youth-agent' ? extra.skills || [] : [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...extra,
  })

  await db.collection('users').doc(uid).set(profile, { merge: true })
  return { uid, email, displayName, userType }
}

async function countCollection(name) {
  const admin = getFirebaseAdmin()
  const snap = await admin.firestore().collection(name).count().get()
  return snap.data().count
}

async function getDoc(collection, id) {
  const admin = getFirebaseAdmin()
  const doc = await admin.firestore().collection(collection).doc(id).get()
  return doc.exists ? { id: doc.id, ...doc.data() } : null
}

async function main() {
  const report = {
    productionUrl: PROD_BASE,
    smeUser: null,
    agentUser: null,
    tender: null,
    attendanceRequestId: null,
    statusTimeline: [],
    briefingReportId: null,
    collectionsBefore: {},
    collectionsAfter: {},
    notificationsCount: 0,
    apiSteps: [],
    bugs: [],
    fixesApplied: [],
  }

  const admin = getFirebaseAdmin()
  report.collectionsBefore = {
    attendanceRequests: await countCollection('attendanceRequests'),
    briefingReports: await countCollection('briefingReports'),
    notifications: await countCollection('notifications'),
    smes: await countCollection('smes'),
    agents: await countCollection('agents'),
  }

  report.smeUser = await ensureUser({
    email: SME_EMAIL,
    password: TEST_PASSWORD,
    displayName: 'Smoke Test SME',
    userType: 'sme',
    extra: { companyName: 'Smoke Test SME (Pty) Ltd' },
  })

  report.agentUser = await ensureUser({
    email: AGENT_EMAIL,
    password: TEST_PASSWORD,
    displayName: 'Smoke Test Agent',
    userType: 'youth-agent',
    extra: { location: 'Gauteng' },
  })

  const smeAuth = await getIdToken(SME_EMAIL, TEST_PASSWORD)
  const agentAuth = await getIdToken(AGENT_EMAIL, TEST_PASSWORD)

  const smeHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${smeAuth.idToken}`,
  }
  const agentHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${agentAuth.idToken}`,
  }

  // Pick compulsory tender from production
  const tendersRes = await fetchJson(`${PROD_BASE}/api/tender-briefings`)
  report.apiSteps.push({ step: 'GET /api/tender-briefings', status: tendersRes.status })
  if (!tendersRes.json.success) {
    throw new Error('Failed to load tenders: ' + (tendersRes.json.error || tendersRes.status))
  }

  const compulsory = (tendersRes.json.data || []).filter((t) => t.briefingCompulsory)
  if (!compulsory.length) {
    throw new Error('No compulsory briefing tenders in production')
  }
  const tender = compulsory[0]
  report.tender = {
    id: tender.id,
    title: tender.title,
    province: tender.province,
    briefingDate: tender.briefingDate,
  }

  // SME creates attendance request
  const createRes = await fetchJson(`${PROD_BASE}/api/attendance-requests`, {
    method: 'POST',
    headers: smeHeaders,
    body: JSON.stringify({
      tenderId: tender.id,
      notes: 'Production smoke test — automated attendance request',
    }),
  })
  report.apiSteps.push({
    step: 'POST /api/attendance-requests',
    status: createRes.status,
    success: createRes.json.success,
  })
  if (!createRes.json.success) {
    throw new Error(createRes.json.error || 'Create request failed')
  }

  const requestId = createRes.json.data?.request?.id
  report.attendanceRequestId = requestId
  report.statusTimeline.push({ at: 'create', status: createRes.json.data?.request?.status || 'pending' })

  let reqDoc = await getDoc('attendanceRequests', requestId)
  if (!reqDoc || reqDoc.status !== 'pending') {
    report.bugs.push('attendanceRequests doc missing or not pending after create')
  }

  // Agent accepts
  const acceptRes = await fetchJson(
    `${PROD_BASE}/api/attendance-requests/${requestId}/accept`,
    { method: 'POST', headers: agentHeaders }
  )
  report.apiSteps.push({
    step: 'POST /api/attendance-requests/:id/accept',
    status: acceptRes.status,
    success: acceptRes.json.success,
  })
  if (!acceptRes.json.success) {
    throw new Error(acceptRes.json.error || 'Accept failed')
  }

  reqDoc = await getDoc('attendanceRequests', requestId)
  report.statusTimeline.push({
    at: 'accept',
    status: reqDoc?.status,
    assignedAgentId: reqDoc?.assignedAgentId,
  })
  if (reqDoc?.status !== 'assigned') {
    report.bugs.push(`Expected assigned after accept, got ${reqDoc?.status}`)
  }

  // Agent submits report
  const reportRes = await fetchJson(`${PROD_BASE}/api/briefing-reports`, {
    method: 'POST',
    headers: agentHeaders,
    body: JSON.stringify({
      requestId,
      tenderId: tender.id,
      summary: 'Smoke test briefing summary: compulsory session attended, key compliance points noted.',
      notes: 'Automated production smoke test report.',
      attendanceProofUrl: 'https://example.com/smoke-proof.pdf',
      documentUrls: ['https://example.com/smoke-photo-1.jpg'],
    }),
  })
  report.apiSteps.push({
    step: 'POST /api/briefing-reports',
    status: reportRes.status,
    success: reportRes.json.success,
  })
  if (!reportRes.json.success) {
    throw new Error(reportRes.json.error || 'Briefing report failed')
  }

  report.briefingReportId = reportRes.json.data?.id
  reqDoc = await getDoc('attendanceRequests', requestId)
  report.statusTimeline.push({ at: 'report', status: reqDoc?.status, reportId: reqDoc?.reportId })

  if (reqDoc?.status !== 'completed') {
    report.bugs.push(`Expected completed after report, got ${reqDoc?.status}`)
  }

  const reportDoc = report.briefingReportId
    ? await getDoc('briefingReports', report.briefingReportId)
    : null
  if (!reportDoc) {
    report.bugs.push('briefingReports document not found after submit')
  }

  // SME views request + reports via API
  const detailRes = await fetchJson(`${PROD_BASE}/api/attendance-requests/${requestId}`, {
    headers: smeHeaders,
  })
  report.apiSteps.push({
    step: 'GET /api/attendance-requests/:id',
    status: detailRes.status,
    reportsCount: detailRes.json.data?.reports?.length,
  })
  if (!detailRes.json.success || !(detailRes.json.data?.reports?.length > 0)) {
    report.bugs.push('SME cannot view briefing report via API')
  }

  const reportsByReq = await fetchJson(
    `${PROD_BASE}/api/briefing-reports/${requestId}`,
    { headers: smeHeaders }
  )
  report.apiSteps.push({
    step: 'GET /api/briefing-reports/:requestId',
    status: reportsByReq.status,
    success: reportsByReq.json.success,
  })

  report.collectionsAfter = {
    attendanceRequests: await countCollection('attendanceRequests'),
    briefingReports: await countCollection('briefingReports'),
    notifications: await countCollection('notifications'),
    smes: await countCollection('smes'),
    agents: await countCollection('agents'),
  }

  const notifSnap = await admin
    .firestore()
    .collection('notifications')
    .orderBy('createdAt', 'desc')
    .limit(10)
    .get()
  report.notificationsCount = notifSnap.size
  report.recentNotificationEvents = notifSnap.docs.map((d) => d.data().eventType).filter(Boolean)

  report.passed = report.bugs.length === 0
  console.log(JSON.stringify(report, null, 2))
  process.exit(report.passed ? 0 : 1)
}

main().catch((err) => {
  console.error(JSON.stringify({ passed: false, error: err.message }))
  process.exit(1)
})
