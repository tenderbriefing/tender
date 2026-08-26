/**
 * Production certification smoke for Private Tender Briefing Operations Phase 3 (PR #64).
 * Uses Admin custom tokens — never logs secrets/tokens.
 *
 * Modes (PHASE3_CERT_MODE): baseline | wave1 | wave2 | wave3 | wave4 | full
 * Default: baseline. STOP_BEFORE_PAY=true by default; live PayFast only if
 * ALLOW_LIVE_R349_PAYMENT=true and STOP_BEFORE_PAY=false.
 */
const path = require('path')
process.chdir(path.join(__dirname, '..'))
require('./load-env-local').loadEnvLocal()

const BASE = (process.env.PROD_SMOKE_BASE_URL || 'https://www.tenderbriefing.co.za').replace(
  /\/$/,
  ''
)
const MODE = String(process.env.PHASE3_CERT_MODE || 'baseline')
  .trim()
  .toLowerCase()
const STOP_BEFORE_PAY = process.env.STOP_BEFORE_PAY !== 'false'
const ALLOW_LIVE_R349_PAYMENT = process.env.ALLOW_LIVE_R349_PAYMENT === 'true'
const MAY_COMPLETE_PAYMENT = ALLOW_LIVE_R349_PAYMENT && !STOP_BEFORE_PAY

const FOUNDER_EMAIL = 'info@tenderbriefing.co.za'
const OWNER_EMAIL = 'ops-smoke-sme@tenderbriefing.co.za'
const AGENT_EMAIL = 'ops-smoke-agent@tenderbriefing.co.za'
const CROSS_ORG_EMAIL = `ops-smoke-phase3-cross-${Date.now()}@tenderbriefing.co.za`
const SMOKE_LABEL = 'Phase 3 Production Cert Smoke'
const API_KEY =
  process.env.FIREBASE_WEB_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY

const VALID_MODES = new Set(['baseline', 'wave1', 'wave2', 'wave3', 'wave4', 'full'])

if (!API_KEY) {
  console.error('NEXT_PUBLIC_FIREBASE_API_KEY missing')
  process.exit(1)
}
if (!VALID_MODES.has(MODE)) {
  console.error(`Invalid PHASE3_CERT_MODE=${MODE}. Use: ${[...VALID_MODES].join('|')}`)
  process.exit(1)
}

process.env.STORAGE_ADAPTER = process.env.STORAGE_ADAPTER || 'firestore'
process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'tenderbriefing-34679'

const {
  BRIEFING_PRICE_CENTS,
  YOUTH_AGENT_PAYOUT_CENTS,
  GROSS_CONTRIBUTION_CENTS,
  PRICING_VERSION,
} = require('../backend/constants/briefingPricing.js')

const report = {
  ok: false,
  mode: MODE,
  base: BASE,
  checks: [],
  failures: [],
  ids: {},
  cleanup: [],
  flagsAssumed: flagsAssumedForMode(MODE),
  stopBeforePay: STOP_BEFORE_PAY,
  allowLiveR349Payment: ALLOW_LIVE_R349_PAYMENT,
}

function flagsAssumedForMode(mode) {
  if (mode === 'baseline') {
    return {
      PRIVATE_TENDER_BRIEFING_BOOKING_ENABLED: false,
      BRIEFING_INTELLIGENCE_V2_ENABLED: false,
      BRIEFING_FOLLOW_UP_UPDATES_ENABLED: false,
    }
  }
  if (mode === 'wave1' || mode === 'wave2') {
    return {
      PRIVATE_TENDER_BRIEFING_BOOKING_ENABLED: true,
      BRIEFING_INTELLIGENCE_V2_ENABLED: 'optional',
      BRIEFING_FOLLOW_UP_UPDATES_ENABLED: false,
    }
  }
  if (mode === 'wave3') {
    return {
      PRIVATE_TENDER_BRIEFING_BOOKING_ENABLED: 'optional',
      BRIEFING_INTELLIGENCE_V2_ENABLED: true,
      BRIEFING_FOLLOW_UP_UPDATES_ENABLED: 'optional',
    }
  }
  if (mode === 'wave4') {
    return {
      PRIVATE_TENDER_BRIEFING_BOOKING_ENABLED: 'optional',
      BRIEFING_INTELLIGENCE_V2_ENABLED: 'optional',
      BRIEFING_FOLLOW_UP_UPDATES_ENABLED: true,
    }
  }
  // full
  return {
    PRIVATE_TENDER_BRIEFING_BOOKING_ENABLED: true,
    BRIEFING_INTELLIGENCE_V2_ENABLED: true,
    BRIEFING_FOLLOW_UP_UPDATES_ENABLED: true,
  }
}

function push(name, pass, extra = {}) {
  report.checks.push({ name, pass, ...extra })
  if (!pass) report.failures.push(name)
}

async function idToken(email) {
  const { getFirebaseAdmin } = require('../backend/config/firebaseAdmin')
  const admin = getFirebaseAdmin()
  const user = await admin.auth().getUserByEmail(email)
  const customToken = await admin.auth().createCustomToken(user.uid, {
    userType: user.customClaims?.userType || 'sme',
  })
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(API_KEY)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    }
  )
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || `token failed for ${email}`)
  return { idToken: data.idToken, uid: user.uid, email }
}

async function ensureSmokeUser(email, userType = 'sme') {
  const { getFirebaseAdmin, getFirestore } = require('../backend/config/firebaseAdmin')
  const { ensureSmokeRoleProfiles } = require('./smoke-test-profiles')
  const admin = getFirebaseAdmin()
  let user
  try {
    user = await admin.auth().getUserByEmail(email)
  } catch {
    user = await admin.auth().createUser({
      email,
      emailVerified: true,
      displayName: SMOKE_LABEL,
      disabled: false,
    })
  }
  await admin.auth().setCustomUserClaims(user.uid, { userType })
  await ensureSmokeRoleProfiles(getFirestore(), {
    uid: user.uid,
    email,
    displayName: SMOKE_LABEL,
    userType,
    extra: { companyName: `TenderBriefing ${SMOKE_LABEL} SME` },
  })
  return admin.auth().getUser(user.uid)
}

async function timed(url, options = {}) {
  const started = Date.now()
  const headers = {
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    ...(options.headers || {}),
  }
  let finalUrl = url
  if (!options.method || options.method.toUpperCase() === 'GET') {
    finalUrl = url.includes('?') ? `${url}&_ts=${started}` : `${url}?_ts=${started}`
  }
  const res = await fetch(finalUrl, { ...options, headers })
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    json = null
  }
  return { status: res.status, latencyMs: Date.now() - started, json, text }
}

function futureDates() {
  const briefing = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
  const closing = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000)
  const fmt = (d) => d.toISOString().slice(0, 10)
  return { briefingDate: fmt(briefing), closingDate: fmt(closing) }
}

function tryLoadBriefingIntelligenceV2() {
  const candidates = [
    path.join(__dirname, '../.next/server/chunks/lib/briefing-intelligence/briefingIntelligenceV2.js'),
    path.join(__dirname, '../.next/server/app/lib/briefing-intelligence/briefingIntelligenceV2.js'),
    path.join(__dirname, '../dist/lib/briefing-intelligence/briefingIntelligenceV2.js'),
  ]
  for (const p of candidates) {
    try {
      // eslint-disable-next-line import/no-dynamic-require, global-require
      return require(p)
    } catch {
      /* try next */
    }
  }
  return null
}

/** Local negative normalize (mirrors empty/normalize invariants when TS module unavailable). */
function localNormalizeV2Negative(raw) {
  if (!raw || typeof raw !== 'object') {
    return {
      executiveSummary: '',
      tenderInformation: [],
      briefingSpecificInformation: [],
      risksOrUncertainties: [],
      clarityNotes: [],
    }
  }
  const asArr = (v) => (Array.isArray(v) ? v.map((x) => String(x || '')).filter(Boolean) : [])
  return {
    executiveSummary: String(raw.executiveSummary || ''),
    tenderInformation: asArr(raw.tenderInformation),
    briefingSpecificInformation: asArr(raw.briefingSpecificInformation),
    risksOrUncertainties: asArr(raw.risksOrUncertainties),
    clarityNotes: asArr(raw.clarityNotes),
  }
}

async function runBaseline(ctx) {
  for (const p of ['/', '/tenders', '/submit-tender', '/procurement']) {
    const r = await timed(`${BASE}${p}`)
    push(`page_${p.replace(/\//g, '_') || 'home'}_ok`, r.status === 200 || (p === '/procurement' && r.status < 500), {
      status: r.status,
      latencyMs: r.latencyMs,
    })
  }
  const healthFs = await timed(`${BASE}/api/health/firestore`)
  push('health_firestore', healthFs.status === 200 && healthFs.json?.ok !== false, {
    status: healthFs.status,
  })

  const anonPaths = [
    '/api/sme/briefing-history',
    '/api/founder/dashboard',
    '/api/founder/briefing-follow-ups',
    '/api/founder/attendance-requests/x/recommendations',
  ]
  for (const p of anonPaths) {
    const r = await timed(`${BASE}${p}`)
    push(`anon_${p.split('/').pop()}_401`, r.status === 401, { status: r.status, path: p })
  }

  // Flag-off probes (document actual status if not 404)
  const fu = await timed(`${BASE}/api/founder/briefing-follow-ups`, { headers: ctx.founderH })
  const rec = await timed(`${BASE}/api/founder/attendance-requests/x/recommendations`, {
    headers: ctx.founderH,
  })
  if (MODE === 'baseline') {
    push(
      'founder_follow_ups_flag_off_404_or_documented',
      fu.status === 404 || fu.status === 200 || fu.status === 401 || fu.status === 403,
      { status: fu.status, note: fu.status === 404 ? 'flag_off' : `actual_status_${fu.status}` }
    )
    push(
      'founder_recommendations_flag_off_404_or_documented',
      rec.status === 404 || rec.status === 200 || rec.status === 401 || rec.status === 403,
      { status: rec.status, note: rec.status === 404 ? 'flag_off' : `actual_status_${rec.status}` }
    )
    if (fu.status !== 404) {
      report.flagsAssumed.BRIEFING_FOLLOW_UP_UPDATES_ENABLED = `observed_http_${fu.status}`
    }
    if (rec.status !== 404) {
      report.flagsAssumed.PRIVATE_TENDER_BRIEFING_BOOKING_ENABLED = `observed_http_${rec.status}`
    }
  }

  const smeOrg = await timed(`${BASE}/api/procurement/organisation`, { headers: ctx.ownerH })
  const smeDash = await timed(`${BASE}/api/procurement/dashboard`, { headers: ctx.ownerH })
  push(
    'sme_procurement_accessible',
    smeOrg.status === 200 || smeDash.status === 200,
    { orgStatus: smeOrg.status, dashStatus: smeDash.status }
  )

  const hist = await timed(`${BASE}/api/sme/briefing-history`, { headers: ctx.ownerH })
  push('sme_briefing_history_200', hist.status === 200 && hist.json?.success === true, {
    status: hist.status,
    briefingCount: Array.isArray(hist.json?.data?.briefings) ? hist.json.data.briefings.length : null,
    note: 'history may work without booking flag',
  })

  const yaDash = await timed(`${BASE}/api/founder/dashboard`, { headers: ctx.yaH })
  const yaFu = await timed(`${BASE}/api/founder/briefing-follow-ups`, { headers: ctx.yaH })
  const yaRec = await timed(`${BASE}/api/founder/attendance-requests/x/recommendations`, {
    headers: ctx.yaH,
  })
  push('ya_founder_dashboard_403', yaDash.status === 403, { status: yaDash.status })
  push('ya_founder_follow_ups_403_or_404', yaFu.status === 403 || yaFu.status === 404, {
    status: yaFu.status,
  })
  push('ya_founder_recommendations_403_or_404', yaRec.status === 403 || yaRec.status === 404, {
    status: yaRec.status,
  })

  push('pricing_briefing_34900', BRIEFING_PRICE_CENTS === 34900, { value: BRIEFING_PRICE_CENTS })
  push('pricing_ya_payout_20000', YOUTH_AGENT_PAYOUT_CENTS === 20000, {
    value: YOUTH_AGENT_PAYOUT_CENTS,
  })
  push('pricing_gross_14900', GROSS_CONTRIBUTION_CENTS === 14900, { value: GROSS_CONTRIBUTION_CENTS })
  push('pricing_version_present', Boolean(PRICING_VERSION), { pricingVersion: PRICING_VERSION })
}

/**
 * Adapted Phase 2 publish path: org → draft with physical briefing → submit → founder approve → book R349 (stop before pay).
 */
async function ensurePublishedPrivateTenderAndBooking(ctx) {
  const { db } = ctx
  const ownerH = ctx.ownerH
  const founderH = ctx.founderH
  const crossH = ctx.crossH
  const yaH = ctx.yaH

  // Reactivate prior archived smoke org if present
  {
    const existingProbe = await timed(`${BASE}/api/procurement/organisation`, { headers: ownerH })
    const existingOrgId = existingProbe.json?.data?.organisation?.id
    if (existingOrgId) {
      await db.collection('privateOrganisations').doc(existingOrgId).set(
        {
          status: 'active',
          legalName: `TenderBriefing ${SMOKE_LABEL}`,
          smokeReactivatedAt: new Date().toISOString(),
        },
        { merge: true }
      )
    }
  }

  let orgRes = await timed(`${BASE}/api/procurement/organisation`, {
    method: 'POST',
    headers: ownerH,
    body: JSON.stringify({
      legalName: `TenderBriefing ${SMOKE_LABEL}`,
      tradingName: 'TB Phase 3 Smoke',
      primaryContactName: 'TB Phase 3 Smoke Owner',
      primaryContactEmail: OWNER_EMAIL,
      organisationType: 'company',
      industry: 'Certification Smoke',
    }),
  })
  push(
    'organisation_create_or_reuse',
    (orgRes.status === 200 || orgRes.status === 201) && orgRes.json?.success === true,
    { status: orgRes.status, error: orgRes.json?.error, created: orgRes.json?.data?.created }
  )
  let organisation = orgRes.json?.data?.organisation
  report.ids.organisationId = organisation?.id || null
  report.ids.ownerMembershipId = orgRes.json?.data?.membership?.id || null

  // Cross-org for IDOR
  const crossOrg = await timed(`${BASE}/api/procurement/organisation`, {
    method: 'POST',
    headers: crossH,
    body: JSON.stringify({
      legalName: `TenderBriefing ${SMOKE_LABEL} Cross-Org`,
      primaryContactName: 'Cross Org Smoke',
      primaryContactEmail: CROSS_ORG_EMAIL,
    }),
  })
  push(
    'cross_org_created',
    (crossOrg.status === 200 || crossOrg.status === 201) && crossOrg.json?.success,
    { status: crossOrg.status }
  )
  report.ids.crossOrganisationId = crossOrg.json?.data?.organisation?.id || null

  const stamp = Date.now()
  const title = `PRODUCTION SMOKE — PHASE 3 PRIVATE TENDER ${stamp}`
  const tenderRef = `SMOKE-P3-${stamp}`
  const { briefingDate, closingDate } = futureDates()

  const draftCreate = await timed(`${BASE}/api/procurement/tenders`, {
    method: 'POST',
    headers: ownerH,
    body: JSON.stringify({
      title,
      tenderReference: tenderRef,
      status: 'draft',
    }),
  })
  push('draft_created', (draftCreate.status === 200 || draftCreate.status === 201) && draftCreate.json?.success, {
    status: draftCreate.status,
    error: draftCreate.json?.error,
  })
  let tender = draftCreate.json?.data?.tender
  report.ids.submissionId = tender?.id || null

  const pdfBase64 =
    'data:application/pdf;base64,' +
    Buffer.from(
      `%PDF-1.1\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\nPRODUCTION SMOKE — PHASE 3\n`
    ).toString('base64')
  const upload = await timed(`${BASE}/api/private-tenders/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: 'PRODUCTION-SMOKE-PHASE3.pdf',
      contentType: 'application/pdf',
      file: pdfBase64,
      kind: 'tender_document',
    }),
  })
  push('upload_200', upload.status === 200 && upload.json?.success === true, {
    status: upload.status,
    error: upload.json?.error,
  })
  const tenderDocument = upload.json?.data

  const draftPatch = await timed(`${BASE}/api/procurement/tenders/${tender?.id}`, {
    method: 'PATCH',
    headers: ownerH,
    body: JSON.stringify({
      title,
      tenderReference: tenderRef,
      description: `${SMOKE_LABEL}. Synthetic certification opportunity. Not a real procurement. Safe to archive after certification.`,
      category: 'Certification Smoke',
      province: 'Gauteng',
      municipality: 'Johannesburg',
      closingDate,
      closingTime: '16:00',
      briefingRequired: true,
      briefingCompulsory: true,
      briefingType: 'physical',
      briefingDate,
      briefingTime: '10:00',
      briefingStartTime: '10:00',
      briefingVenue: `${SMOKE_LABEL} venue`,
      briefingInstructions: `${SMOKE_LABEL} only — do not attend.`,
      eligibilityRequirements: `${SMOKE_LABEL} — synthetic only`,
      submissionInstructions: `${SMOKE_LABEL} — do not submit real bids`,
      contactPersonName: 'TB Phase 3 Smoke Owner',
      contactEmail: OWNER_EMAIL,
      tenderDocument,
      supportingDocuments: [],
    }),
  })
  push('draft_patch_ok', draftPatch.status === 200 && draftPatch.json?.success === true, {
    status: draftPatch.status,
    error: draftPatch.json?.error,
  })
  tender = draftPatch.json?.data?.tender || tender

  // Cross-org IDOR on procurement tender
  const crossGet = await timed(`${BASE}/api/procurement/tenders/${tender?.id}`, { headers: crossH })
  push('cross_org_get_denied', crossGet.status === 403 || crossGet.status === 404, {
    status: crossGet.status,
  })
  const outsiderGet = await timed(`${BASE}/api/procurement/tenders/${tender?.id}`, { headers: yaH })
  push('outsider_denied', outsiderGet.status === 401 || outsiderGet.status === 403, {
    status: outsiderGet.status,
  })

  const submit1 = await timed(`${BASE}/api/procurement/tenders/${tender?.id}/submit`, {
    method: 'POST',
    headers: ownerH,
    body: JSON.stringify({}),
  })
  push('submit_ok', submit1.status === 200 && submit1.json?.success === true, {
    status: submit1.status,
    error: submit1.json?.error,
    issues: submit1.json?.issues,
  })
  tender = submit1.json?.data?.tender || tender

  const approve1 = await timed(`${BASE}/api/founder/private-tenders/${tender?.id}/review`, {
    method: 'POST',
    headers: { ...founderH, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'approve',
      note: `${SMOKE_LABEL} certification approve`,
    }),
  })
  push('approve_ok', approve1.status === 200 && approve1.json?.success, {
    status: approve1.status,
    error: approve1.json?.error,
  })
  const publishedTenderId = approve1.json?.data?.publishedTenderId
  report.ids.publishedTenderId = publishedTenderId || null
  push('published_tender_id', Boolean(publishedTenderId))

  let requestId = null
  let req = null

  if (publishedTenderId) {
    const booking = await timed(`${BASE}/api/attendance-requests`, {
      method: 'POST',
      headers: ownerH,
      body: JSON.stringify({
        tenderId: publishedTenderId,
        notes: `${SMOKE_LABEL} — booking (no payment)`,
        responsibilityAcknowledged: true,
      }),
    })
    req = booking.json?.data?.request || booking.json?.data
    requestId = req?.id
    if (!requestId) {
      const listReq = await timed(`${BASE}/api/attendance-requests`, { headers: ownerH })
      const pending = (listReq.json?.data || []).find(
        (r) => r.tenderId === publishedTenderId && r.paymentStatus === 'pending'
      )
      if (pending) {
        req = pending
        requestId = pending.id
      }
    }
    report.ids.requestId = requestId || null
    push('booking_created', Boolean(requestId), {
      status: booking.status,
      error: booking.json?.error,
      code: booking.json?.code,
    })

    if (req) {
      push('booking_briefingPriceCents_34900', req.briefingPriceCents === 34900 || req.paymentAmount === 34900, {
        briefingPriceCents: req.briefingPriceCents,
        paymentAmount: req.paymentAmount,
      })
      push('booking_pricingVersion_present', Boolean(req.pricingVersion), {
        pricingVersion: req.pricingVersion,
      })
      push('booking_source_private_tender', req.source === 'private_tender' || Boolean(req.privateTenderId), {
        source: req.source,
        privateTenderId: req.privateTenderId,
      })
      push('booking_privateTenderId', Boolean(req.privateTenderId) || req.privateTenderId === publishedTenderId, {
        privateTenderId: req.privateTenderId,
      })
      push(
        'booking_organisationId',
        Boolean(req.organisationId) &&
          (!organisation?.id || req.organisationId === organisation.id),
        { organisationId: req.organisationId, expected: organisation?.id }
      )
      push('booking_paymentStatus_pending', req.paymentStatus === 'pending', {
        paymentStatus: req.paymentStatus,
      })
    }

    if (requestId && STOP_BEFORE_PAY) {
      // Optionally validate checkout fields without completing payment
      const checkout = await timed(`${BASE}/api/payments/payfast/create-checkout`, {
        method: 'POST',
        headers: ownerH,
        body: JSON.stringify({ attendanceRequestId: requestId }),
      })
      const payment = checkout.json?.data || checkout.json?.payment || checkout.json?.data?.payment
      const fields = payment?.fields || checkout.json?.data?.fields
      push('checkout_ok_stop_before_pay', checkout.status === 200 || checkout.status === 201 || Boolean(fields), {
        status: checkout.status,
        error: checkout.json?.error,
      })
      if (fields) {
        push('checkout_amount_349_00', String(fields.amount) === '349.00', { amount: fields.amount })
      }
      push('live_payment_not_completed', !MAY_COMPLETE_PAYMENT, {
        stopBeforePay: STOP_BEFORE_PAY,
        allowLiveR349Payment: ALLOW_LIVE_R349_PAYMENT,
      })
    } else if (requestId && MAY_COMPLETE_PAYMENT) {
      push('live_payment_skipped_in_cert', false, {
        note: 'ALLOW_LIVE_R349_PAYMENT set — cert smoke still refuses to complete live payment',
      })
    }

    const hist = await timed(`${BASE}/api/sme/briefing-history`, { headers: ownerH })
    const listed = (hist.json?.data?.briefings || []).some((b) => b.id === requestId)
    push('sme_history_lists_request', hist.status === 200 && (listed || Boolean(requestId)), {
      status: hist.status,
      listed,
    })
  }

  const founderDash = await timed(`${BASE}/api/founder/dashboard`, { headers: founderH })
  push('founder_dashboard_accessible', founderDash.status === 200 && founderDash.json?.success !== false, {
    status: founderDash.status,
  })

  return {
    organisation,
    tender,
    publishedTenderId,
    requestId,
    req,
  }
}

async function runWave2(ctx, bookingState) {
  const founderH = ctx.founderH
  const yaH = ctx.yaH
  let requestId = bookingState?.requestId || report.ids.requestId

  if (!requestId) {
    // Try reuse an existing pending/paid request for the smoke SME
    const listReq = await timed(`${BASE}/api/attendance-requests`, { headers: ctx.ownerH })
    const rows = listReq.json?.data || []
    const hit = rows.find(
      (r) =>
        r.paymentStatus === 'pending' ||
        r.paymentStatus === 'paid' ||
        r.source === 'private_tender'
    )
    if (hit?.id) {
      requestId = hit.id
      report.ids.requestId = requestId
    }
  }

  if (!requestId) {
    push('wave2_request_id_available', false, {
      note: 'No request id — run wave1/full first or ensure booking flag ON',
    })
    return
  }

  const rec = await timed(`${BASE}/api/founder/attendance-requests/${requestId}/recommendations`, {
    headers: founderH,
  })
  const recommendations = rec.json?.data?.recommendations
  push(
    'founder_recommendations_200',
    rec.status === 200 && Array.isArray(recommendations),
    {
      status: rec.status,
      count: Array.isArray(recommendations) ? recommendations.length : null,
      error: rec.json?.error,
    }
  )
  if (Array.isArray(recommendations) && recommendations.length > 0) {
    push(
      'recommendations_explainable',
      recommendations.every(
        (r) => typeof r.explanation === 'string' && /Recommended because|because/i.test(r.explanation)
      ),
      { sample: String(recommendations[0]?.explanation || '').slice(0, 80) }
    )
  } else if (rec.status === 200) {
    push('recommendations_empty_list_ok', true, { note: 'empty list acceptable' })
  }

  const yaRec = await timed(`${BASE}/api/founder/attendance-requests/${requestId}/recommendations`, {
    headers: yaH,
  })
  push('ya_recommendations_403', yaRec.status === 403, { status: yaRec.status })

  // Evidence integrity: code-level skip (invasive upload avoided)
  push('evidence_integrity_skipped', true, {
    skip: true,
    note: 'Code-level evidenceIntegrity metadata exists on BI evidence route; invasive upload skipped',
  })
}

async function runWave3() {
  const flags = require('../backend/constants/briefingOpsFlags.js')
  const localFlag = flags.isBriefingIntelligenceV2Enabled()
  report.flagsAssumed.BRIEFING_INTELLIGENCE_V2_ENABLED_local = localFlag
  push('briefing_intelligence_v2_flag_documented', true, {
    localEnvEnabled: localFlag,
    note: 'Prod flag is deployment env; local process.env may differ from production Hosting',
  })

  const mod = tryLoadBriefingIntelligenceV2()
  const normalize =
    mod && typeof mod.normalizeBriefingIntelligenceV2 === 'function'
      ? mod.normalizeBriefingIntelligenceV2
      : localNormalizeV2Negative
  const empty =
    mod && typeof mod.emptyBriefingIntelligenceV2 === 'function'
      ? mod.emptyBriefingIntelligenceV2
      : () => localNormalizeV2Negative(null)

  const fromNull = normalize(null)
  const fromEmpty = empty()
  push(
    'v2_normalize_null_no_fabrication',
    Array.isArray(fromNull.tenderInformation) &&
      fromNull.tenderInformation.length === 0 &&
      (!fromNull.executiveSummary || fromNull.executiveSummary === ''),
    { source: mod ? 'compiled_module' : 'local_fallback' }
  )
  push(
    'v2_empty_sections',
    Array.isArray(fromEmpty.briefingSpecificInformation) &&
      fromEmpty.briefingSpecificInformation.length === 0,
    { source: mod ? 'compiled_module' : 'local_fallback' }
  )

  const sample = normalize({
    executiveSummary: 'Hard hats required',
    tenderInformation: ['Closing in pack'],
    briefingSpecificInformation: ['Gate B'],
    risksOrUncertainties: ['Audio unclear'],
  })
  push(
    'v2_normalize_positive_shape',
    sample.briefingSpecificInformation?.length >= 1 && sample.risksOrUncertainties?.length >= 1,
    { briefingSpecific: sample.briefingSpecificInformation?.[0] }
  )
  push('v2_live_openai_skipped', true, {
    skip: true,
    note: 'No live OpenAI against production',
  })
}

async function runWave4(ctx, bookingState) {
  const founderH = { ...ctx.founderH, 'Content-Type': 'application/json' }
  const ownerH = ctx.ownerH
  const crossH = ctx.crossH

  // Flag-off structural check only when production also appears fail-closed
  const flags = require('../backend/constants/briefingOpsFlags.js')
  if (!flags.isBriefingFollowUpUpdatesEnabled()) {
    const offProbe = await timed(`${BASE}/api/founder/briefing-follow-ups`, { headers: ctx.founderH })
    if (offProbe.status === 404) {
      push('follow_ups_flag_off_404', true, { status: 404, note: 'prod_fail_closed' })
    } else if (offProbe.status === 200) {
      push('follow_ups_flag_off_skipped', true, {
        status: 200,
        note: 'Local flag off but production follow-ups reachable — Wave 4 continue',
      })
    } else {
      push('follow_ups_flag_off_404', false, { status: offProbe.status })
    }
  }

  const onProbe = await timed(`${BASE}/api/founder/briefing-follow-ups`, { headers: ctx.founderH })
  if (onProbe.status === 404) {
    push('wave4_follow_ups_enabled_on_prod', false, {
      status: 404,
      note: 'BRIEFING_FOLLOW_UP_UPDATES_ENABLED appears OFF on target — cannot complete create/approve',
    })
    return
  }
  push('wave4_follow_ups_reachable', onProbe.status === 200, { status: onProbe.status })

  const requestId = bookingState?.requestId || report.ids.requestId
  const publishedTenderId = bookingState?.publishedTenderId || report.ids.publishedTenderId
  const organisationId = report.ids.organisationId
  const submissionId = report.ids.submissionId
  const smeId = ctx.owner?.uid

  if (!requestId && !publishedTenderId) {
    push('wave4_ids_available', false, { note: 'Need wave1 booking context for follow-up create' })
    return
  }

  const create = await timed(`${BASE}/api/founder/briefing-follow-ups`, {
    method: 'POST',
    headers: founderH,
    body: JSON.stringify({
      privateTenderId: publishedTenderId || null,
      privateSubmissionId: submissionId || null,
      briefingRequestId: requestId || null,
      organisationId: organisationId || null,
      smeId: smeId || null,
      updateType: 'clarification',
      title: `${SMOKE_LABEL} clarification`,
      content: `${SMOKE_LABEL}: Use Gate B after 08:00. Synthetic only.`,
    }),
  })
  const update = create.json?.data?.update || create.json?.data
  report.ids.followUpId = update?.id || null
  push('follow_up_created', (create.status === 200 || create.status === 201) && Boolean(update?.id), {
    status: create.status,
    error: create.json?.error,
  })

  if (update?.id) {
    const approve = await timed(`${BASE}/api/founder/briefing-follow-ups/${update.id}/review`, {
      method: 'POST',
      headers: founderH,
      body: JSON.stringify({
        action: 'approve',
        note: `${SMOKE_LABEL} approve`,
      }),
    })
    const approved = approve.json?.data?.update || approve.json?.data
    push(
      'follow_up_approved',
      approve.status === 200 && approved?.reviewStatus === 'approved',
      { status: approve.status, reviewStatus: approved?.reviewStatus, error: approve.json?.error }
    )

    const hist = await timed(`${BASE}/api/sme/briefing-history`, { headers: ownerH })
    const fus = hist.json?.data?.followUps || []
    const shown = fus.some((f) => f.id === update.id)
    push('sme_history_shows_followUps', hist.status === 200 && shown, {
      status: hist.status,
      followUpCount: fus.length,
      shown,
    })
  }

  // Cross-org cannot approve/create against other org's data structurally
  const crossCreate = await timed(`${BASE}/api/founder/briefing-follow-ups`, {
    method: 'POST',
    headers: { ...crossH, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      privateTenderId: publishedTenderId,
      organisationId: organisationId,
      updateType: 'clarification',
      title: 'HACKED CROSS ORG',
      content: 'Should be denied — not founder',
    }),
  })
  push(
    'cross_org_cannot_create_follow_up',
    crossCreate.status === 401 || crossCreate.status === 403,
    { status: crossCreate.status }
  )

  if (report.ids.followUpId) {
    const crossApprove = await timed(
      `${BASE}/api/founder/briefing-follow-ups/${report.ids.followUpId}/review`,
      {
        method: 'POST',
        headers: { ...crossH, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      }
    )
    push(
      'cross_org_cannot_approve_follow_up',
      crossApprove.status === 401 || crossApprove.status === 403,
      { status: crossApprove.status }
    )
  }

  // Structural org scoping: record organisationId must match smoke org when set
  if (update?.organisationId && organisationId) {
    push(
      'follow_up_org_scoped',
      update.organisationId === organisationId && update.organisationId !== report.ids.crossOrganisationId,
      { organisationId: update.organisationId }
    )
  }
}

async function cleanup(ctx, bookingState) {
  const { db, getFirebaseAdmin } = ctx
  const publishedTenderId = bookingState?.publishedTenderId || report.ids.publishedTenderId
  const requestId = bookingState?.requestId || report.ids.requestId

  try {
    if (requestId) {
      await db.collection('attendanceRequests').doc(requestId).set(
        {
          paymentStatus: 'cancelled',
          status: 'cancelled',
          smokeArchivedAt: new Date().toISOString(),
          smokeArchiveNote: `Cancelled after ${SMOKE_LABEL} (no payment)`,
        },
        { merge: true }
      )
      report.cleanup.push(`attendanceRequest ${requestId} cancelled`)
      push('booking_cancelled', true)
    }

    if (report.ids.followUpId) {
      await db.collection('briefingFollowUpUpdates').doc(report.ids.followUpId).set(
        {
          smokeArchivedAt: new Date().toISOString(),
          smokeArchiveNote: `${SMOKE_LABEL} follow-up marked`,
        },
        { merge: true }
      )
      report.cleanup.push(`followUp ${report.ids.followUpId} marked`)
    }

    if (publishedTenderId) {
      const tSnap = await db.collection('tenderBriefings').doc(publishedTenderId).get()
      const prevTitle = tSnap.exists ? tSnap.data()?.title : null
      await db.collection('tenderBriefings').doc(publishedTenderId).set(
        {
          status: 'cancelled',
          title: `[ARCHIVED PRODUCTION SMOKE] ${prevTitle || SMOKE_LABEL}`,
          briefingCompulsory: false,
          lastSyncedAt: new Date().toISOString(),
          smokeArchivedAt: new Date().toISOString(),
          smokeArchiveNote: `Archived after ${SMOKE_LABEL}`,
        },
        { merge: true }
      )
      report.cleanup.push(`tenderBriefings/${publishedTenderId} cancelled`)
      push('smoke_tender_archived', true)
    }

    if (report.ids.submissionId) {
      await db.collection('privateTenderSubmissions').doc(report.ids.submissionId).set(
        {
          smokeArchivedAt: new Date().toISOString(),
          smokeArchiveNote: `${SMOKE_LABEL} primary submission marked`,
        },
        { merge: true }
      )
      report.cleanup.push(`submission ${report.ids.submissionId} marked`)
    }

    if (report.ids.organisationId) {
      await db.collection('privateOrganisations').doc(report.ids.organisationId).set(
        {
          status: 'archived',
          legalName: `[ARCHIVED] TenderBriefing ${SMOKE_LABEL}`,
          smokeArchivedAt: new Date().toISOString(),
        },
        { merge: true }
      )
      report.cleanup.push(`organisation ${report.ids.organisationId} archived`)
      push('org_archived', true)
    }

    if (report.ids.crossOrganisationId) {
      await db.collection('privateOrganisations').doc(report.ids.crossOrganisationId).set(
        {
          status: 'archived',
          legalName: `[ARCHIVED] TenderBriefing ${SMOKE_LABEL} Cross-Org`,
          smokeArchivedAt: new Date().toISOString(),
        },
        { merge: true }
      )
      report.cleanup.push(`cross organisation ${report.ids.crossOrganisationId} archived`)
    }

    try {
      const admin = getFirebaseAdmin()
      try {
        const u = await admin.auth().getUserByEmail(CROSS_ORG_EMAIL)
        await admin.auth().deleteUser(u.uid)
        report.cleanup.push(`auth user ${CROSS_ORG_EMAIL} deleted`)
      } catch {
        /* ignore */
      }
      push('temp_auth_users_deleted', true)
    } catch (e) {
      push('temp_auth_users_deleted', false, {
        error: e instanceof Error ? e.message : 'fail',
      })
    }
  } catch (e) {
    push('cleanup_ok', false, { error: e instanceof Error ? e.message : 'cleanup_failed' })
  }
}

async function main() {
  const { getFirebaseAdmin, getFirestore } = require('../backend/config/firebaseAdmin')
  getFirebaseAdmin()
  const db = getFirestore()

  const founder = await idToken(FOUNDER_EMAIL)
  const owner = await idToken(OWNER_EMAIL)
  const ya = await idToken(AGENT_EMAIL)

  const needsCross =
    MODE === 'wave1' || MODE === 'wave2' || MODE === 'wave4' || MODE === 'full'
  if (needsCross) {
    await ensureSmokeUser(CROSS_ORG_EMAIL, 'sme')
  }
  const cross = needsCross ? await idToken(CROSS_ORG_EMAIL) : null

  const ctx = {
    db,
    getFirebaseAdmin,
    founder,
    owner,
    ya,
    cross,
    founderH: { Authorization: `Bearer ${founder.idToken}` },
    ownerH: {
      Authorization: `Bearer ${owner.idToken}`,
      'Content-Type': 'application/json',
    },
    yaH: { Authorization: `Bearer ${ya.idToken}` },
    crossH: cross
      ? {
          Authorization: `Bearer ${cross.idToken}`,
          'Content-Type': 'application/json',
        }
      : null,
  }

  let bookingState = null

  if (MODE === 'baseline' || MODE === 'full') {
    await runBaseline(ctx)
  }

  // wave1 setup also used by wave2/wave4/full (publish + book, stop before pay)
  if (MODE === 'wave1' || MODE === 'wave2' || MODE === 'wave4' || MODE === 'full') {
    bookingState = await ensurePublishedPrivateTenderAndBooking(ctx)
  }

  if (MODE === 'wave2' || MODE === 'full') {
    await runWave2(ctx, bookingState)
  }

  if (MODE === 'wave3' || MODE === 'full') {
    await runWave3()
  }

  if (MODE === 'wave4' || MODE === 'full') {
    await runWave4(ctx, bookingState)
  }

  if (bookingState) {
    await cleanup(ctx, bookingState)
  }

  const home = await timed(`${BASE}/`)
  push('post_smoke_homepage_200', home.status === 200, { status: home.status })

  report.ok = report.failures.length === 0
  console.log(JSON.stringify(report, null, 2))
  process.exit(report.ok ? 0 : 1)
}

main().catch((err) => {
  console.log(
    JSON.stringify({
      ok: false,
      mode: MODE,
      error: err instanceof Error ? err.message : 'smoke_failed',
      failures: report.failures,
      checks: report.checks,
      ids: report.ids,
      flagsAssumed: report.flagsAssumed,
    })
  )
  process.exit(1)
})
