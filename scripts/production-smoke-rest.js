#!/usr/bin/env node
/**
 * Production smoke test using Firebase Auth REST + production APIs only.
 * No service account required. Does not log passwords.
 */
const PROD = 'https://tenderbriefing-xzgs5uw5ta-bq.a.run.app'
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyDk_QBzmOXJfdl4PPqycoKtecGu0ioCRuY'
const SME_EMAIL = 'ops-smoke-sme@tenderbriefing.co.za'
const AGENT_EMAIL = 'ops-smoke-agent@tenderbriefing.co.za'
const PASSWORD = process.env.SMOKE_TEST_PASSWORD || 'TenderBriefing_Smoke2026!'

async function authRequest(path, body) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/${path}?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  )
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || path)
  return data
}

async function ensureAuthUser(email, password) {
  try {
    return await authRequest('accounts:signInWithPassword', {
      email,
      password,
      returnSecureToken: true,
    })
  } catch (e) {
    const msg = String(e.message)
    const retryWithSignUp =
      msg.includes('EMAIL_NOT_FOUND') ||
      msg.includes('INVALID_LOGIN') ||
      msg.includes('INVALID_PASSWORD')

    if (!retryWithSignUp) throw e

    try {
      return await authRequest('accounts:signUp', {
        email,
        password,
        returnSecureToken: true,
      })
    } catch (signUpErr) {
      if (String(signUpErr.message).includes('EMAIL_EXISTS')) {
        return authRequest('accounts:signInWithPassword', {
          email,
          password,
          returnSecureToken: true,
        })
      }
      throw signUpErr
    }
  }
}

function firestoreFields(obj) {
  const fields = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue
    if (typeof v === 'string') fields[k] = { stringValue: v }
    else if (typeof v === 'number') fields[k] = { integerValue: String(v) }
    else if (typeof v === 'boolean') fields[k] = { booleanValue: v }
    else if (Array.isArray(v)) {
      fields[k] = {
        arrayValue: {
          values: v.map((item) =>
            typeof item === 'string' ? { stringValue: item } : { stringValue: String(item) }
          ),
        },
      }
    }
  }
  return fields
}

async function upsertUserProfile(idToken, uid, profile) {
  const url = `https://firestore.googleapis.com/v1/projects/tenderbriefing-34679/databases/(default)/documents/users/${uid}?currentDocument.exists=true`
  const patchUrl = `https://firestore.googleapis.com/v1/projects/tenderbriefing-34679/databases/(default)/documents/users/${uid}`

  const body = { fields: firestoreFields(profile) }
  let res = await fetch(patchUrl, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (res.status === 404 || !res.ok) {
    res = await fetch(patchUrl.replace('?currentDocument.exists=true', ''), {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  }

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Firestore profile write failed: ${res.status} ${err.slice(0, 120)}`)
  }
}

async function api(base, path, token, options = {}) {
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  })
  const json = await res.json().catch(() => ({}))
  return { status: res.status, json }
}

async function main() {
  const report = {
    productionUrl: PROD,
    smeUser: { email: SME_EMAIL },
    agentUser: { email: AGENT_EMAIL },
    tender: null,
    attendanceRequestId: null,
    statusTimeline: [],
    briefingReportId: null,
    apiSteps: [],
    bugs: [],
    fixesApplied: [],
    passed: false,
  }

  const smeAuth = await ensureAuthUser(SME_EMAIL, PASSWORD)
  const agentAuth = await ensureAuthUser(AGENT_EMAIL, PASSWORD)

  report.smeUser.uid = smeAuth.localId
  report.agentUser.uid = agentAuth.localId

  await upsertUserProfile(smeAuth.idToken, smeAuth.localId, {
    uid: smeAuth.localId,
    email: SME_EMAIL,
    displayName: 'Smoke Test SME',
    role: 'sme',
    userType: 'sme',
    companyName: 'Smoke Test SME Pty Ltd',
    contactPerson: 'Smoke Test SME',
    phoneNumber: '+27123456789',
    province: 'Gauteng',
    location: 'Gauteng',
    categories: ['information-technology'],
    sectors: ['information-technology'],
    csdNumber: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })

  await upsertUserProfile(agentAuth.idToken, agentAuth.localId, {
    uid: agentAuth.localId,
    email: AGENT_EMAIL,
    displayName: 'Smoke Test Agent',
    role: 'youth-agent',
    userType: 'youth-agent',
    phoneNumber: '+27123456789',
    province: 'Gauteng',
    city: 'Johannesburg',
    location: 'Johannesburg, Gauteng',
    availabilityRadiusKm: 25,
    transportAvailable: true,
    preferredServiceAreas: ['Gauteng'],
    verificationStatus: 'verified',
    reliabilityScore: 100,
    completedBriefingCount: 0,
    acceptedBriefingCount: 0,
    missedBriefingCount: 0,
    rating: 4,
    availability: 'available',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })

  const tenders = await api(PROD, '/api/tender-briefings', smeAuth.idToken)
  report.apiSteps.push({ step: 'GET /api/tender-briefings', status: tenders.status })
  if (!tenders.json.success) throw new Error(tenders.json.error || 'tenders failed')

  const compulsory = (tenders.json.data || []).filter((t) => t.briefingCompulsory)
  if (!compulsory.length) throw new Error('No compulsory tenders')
  const tender = compulsory[0]
  report.tender = { id: tender.id, title: tender.title, province: tender.province }

  const create = await api(PROD, '/api/attendance-requests', smeAuth.idToken, {
    method: 'POST',
    body: JSON.stringify({
      tenderId: tender.id,
      notes: 'Production REST smoke test',
    }),
  })
  report.apiSteps.push({ step: 'POST /api/attendance-requests', status: create.status, success: create.json.success })
  if (!create.json.success) throw new Error(create.json.error || 'create failed')

  const requestId = create.json.data?.request?.id
  report.attendanceRequestId = requestId
  report.statusTimeline.push({ at: 'create', status: create.json.data?.request?.status })

  const accept = await api(PROD, `/api/attendance-requests/${requestId}/accept`, agentAuth.idToken, {
    method: 'POST',
  })
  report.apiSteps.push({ step: 'POST accept', status: accept.status, success: accept.json.success })
  if (!accept.json.success) throw new Error(accept.json.error || 'accept failed')
  report.statusTimeline.push({ at: 'accept', status: accept.json.data?.status, assignedAgentId: accept.json.data?.assignedAgentId })

  const br = await api(PROD, '/api/briefing-reports', agentAuth.idToken, {
    method: 'POST',
    body: JSON.stringify({
      requestId,
      tenderId: tender.id,
      summary: 'Smoke test: briefing attended, compliance notes captured.',
      notes: 'REST smoke test',
      attendanceProofUrl: 'https://example.com/proof.pdf',
      documentUrls: ['https://example.com/doc1.jpg'],
    }),
  })
  report.apiSteps.push({ step: 'POST /api/briefing-reports', status: br.status, success: br.json.success })
  if (!br.json.success) throw new Error(br.json.error || 'report failed')
  report.briefingReportId = br.json.data?.id
  report.statusTimeline.push({ at: 'report', status: 'completed', reportId: br.json.data?.id })

  const detail = await api(PROD, `/api/attendance-requests/${requestId}`, smeAuth.idToken)
  report.apiSteps.push({
    step: 'GET request detail',
    status: detail.status,
    requestStatus: detail.json.data?.request?.status,
    reportsCount: detail.json.data?.reports?.length,
  })
  if (detail.json.data?.request?.status !== 'completed') {
    report.bugs.push(`SME detail status=${detail.json.data?.request?.status}`)
  }
  if (!(detail.json.data?.reports?.length > 0)) {
    report.bugs.push('SME cannot see reports on detail endpoint')
  }

  const reportsRoute = await api(PROD, `/api/briefing-reports/${requestId}`, smeAuth.idToken)
  report.apiSteps.push({ step: 'GET /api/briefing-reports/:requestId', status: reportsRoute.status, success: reportsRoute.json.success })

  report.passed = report.bugs.length === 0
  console.log(JSON.stringify(report, null, 2))
  process.exit(report.passed ? 0 : 1)
}

main().catch((e) => {
  console.log(JSON.stringify({ passed: false, error: e.message, bugs: [] }, null, 2))
  process.exit(1)
})
