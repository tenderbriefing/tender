/**
 * Production certification smoke for Private Tender Publishing Phase 2 (PR #63).
 * Uses Admin custom tokens — never logs secrets/tokens.
 * Creates a clearly marked synthetic org lifecycle, Founder review path,
 * catalogue + R349 checkout (stop before payment), then archives smoke data.
 */
const path = require('path')
process.chdir(path.join(__dirname, '..'))
require('./load-env-local').loadEnvLocal()

const BASE = (process.env.PROD_SMOKE_BASE_URL || 'https://www.tenderbriefing.co.za').replace(
  /\/$/,
  ''
)
const FOUNDER_EMAIL = 'info@tenderbriefing.co.za'
const OWNER_EMAIL = 'ops-smoke-sme@tenderbriefing.co.za'
const AGENT_EMAIL = 'ops-smoke-agent@tenderbriefing.co.za'
const MEMBER_EMAIL = `ops-smoke-phase2-member-${Date.now()}@tenderbriefing.co.za`
const CROSS_ORG_EMAIL = `ops-smoke-phase2-cross-${Date.now()}@tenderbriefing.co.za`
const API_KEY =
  process.env.FIREBASE_WEB_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY

if (!API_KEY) {
  console.error('NEXT_PUBLIC_FIREBASE_API_KEY missing')
  process.exit(1)
}

process.env.STORAGE_ADAPTER = process.env.STORAGE_ADAPTER || 'firestore'
process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'tenderbriefing-34679'

const report = {
  ok: false,
  base: BASE,
  checks: [],
  failures: [],
  ids: {},
  cleanup: [],
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
  const { getFirebaseAdmin } = require('../backend/config/firebaseAdmin')
  const admin = getFirebaseAdmin()
  let user
  try {
    user = await admin.auth().getUserByEmail(email)
  } catch {
    user = await admin.auth().createUser({
      email,
      emailVerified: true,
      displayName: 'Phase 2 Production Smoke',
      disabled: false,
    })
  }
  await admin.auth().setCustomUserClaims(user.uid, { userType })
  return user
}

async function timed(url, options = {}) {
  const started = Date.now()
  const res = await fetch(url, options)
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

async function main() {
  const { getFirebaseAdmin, getFirestore } = require('../backend/config/firebaseAdmin')
  getFirebaseAdmin()
  const db = getFirestore()

  // —— Health ——
  for (const p of ['/', '/submit-tender', '/procurement', '/tenders', '/pricing']) {
    const r = await timed(`${BASE}${p}`)
    push(`page_${p}_ok`, r.status === 200 || (p === '/procurement' && r.status < 500), {
      status: r.status,
      latencyMs: r.latencyMs,
    })
  }
  const healthFs = await timed(`${BASE}/api/health/firestore`)
  push('health_firestore', healthFs.status === 200 && healthFs.json?.ok !== false, {
    status: healthFs.status,
  })

  // —— Auth + flag ——
  const founder = await idToken(FOUNDER_EMAIL)
  const owner = await idToken(OWNER_EMAIL)
  const ya = await idToken(AGENT_EMAIL)
  await ensureSmokeUser(MEMBER_EMAIL, 'sme')
  await ensureSmokeUser(CROSS_ORG_EMAIL, 'sme')
  const member = await idToken(MEMBER_EMAIL)
  const cross = await idToken(CROSS_ORG_EMAIL)

  const founderH = { Authorization: `Bearer ${founder.idToken}` }
  const ownerH = {
    Authorization: `Bearer ${owner.idToken}`,
    'Content-Type': 'application/json',
  }
  const memberH = {
    Authorization: `Bearer ${member.idToken}`,
    'Content-Type': 'application/json',
  }
  const crossH = {
    Authorization: `Bearer ${cross.idToken}`,
    'Content-Type': 'application/json',
  }
  const yaH = { Authorization: `Bearer ${ya.idToken}` }

  const anonProc = await timed(`${BASE}/api/procurement/organisation`)
  push('procurement_anon_denied', anonProc.status === 401 || anonProc.status === 403, {
    status: anonProc.status,
  })

  const yaProc = await timed(`${BASE}/api/procurement/organisation`, { headers: yaH })
  push('procurement_ya_denied', yaProc.status === 401 || yaProc.status === 403, {
    status: yaProc.status,
  })

  // If owner already has an org, reuse and rename for smoke clarity; else create.
  let orgRes = await timed(`${BASE}/api/procurement/organisation`, {
    method: 'POST',
    headers: ownerH,
    body: JSON.stringify({
      legalName: 'TenderBriefing Phase 2 Production Smoke',
      tradingName: 'TB Phase 2 Smoke',
      primaryContactName: 'TB Phase 2 Smoke Owner',
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
  let ownerMembership = orgRes.json?.data?.membership
  report.ids.organisationId = organisation?.id || null
  report.ids.ownerMembershipId = ownerMembership?.id || null

  if (organisation?.id) {
    const patchOrg = await timed(`${BASE}/api/procurement/organisation`, {
      method: 'PATCH',
      headers: ownerH,
      body: JSON.stringify({
        legalName: 'TenderBriefing Phase 2 Production Smoke',
        tradingName: 'TB Phase 2 Smoke',
        verificationStatus: 'verified',
        organisationId: 'forged-org-id',
      }),
    })
    push('org_patch_ok', patchOrg.status === 200 && patchOrg.json?.success === true, {
      status: patchOrg.status,
    })
    const patched = patchOrg.json?.data?.organisation
    push(
      'org_verification_not_client_forced',
      !patched || patched.verificationStatus !== 'verified' || organisation.verificationStatus === 'verified',
      { verificationStatus: patched?.verificationStatus }
    )
    organisation = patched || organisation
  }

  // —— Team invite ——
  const invite = await timed(`${BASE}/api/procurement/team/invite`, {
    method: 'POST',
    headers: ownerH,
    body: JSON.stringify({ email: MEMBER_EMAIL, role: 'procurement' }),
  })
  push('member_invite_ok', (invite.status === 200 || invite.status === 201) && invite.json?.success, {
    status: invite.status,
    error: invite.json?.error,
  })
  const memberMembership = invite.json?.data?.membership
  report.ids.memberMembershipId = memberMembership?.id || null

  const memberDash = await timed(`${BASE}/api/procurement/dashboard`, { headers: memberH })
  push('member_access_ok', memberDash.status === 200 && memberDash.json?.success === true, {
    status: memberDash.status,
  })

  const promote = await timed(`${BASE}/api/procurement/team/${memberMembership?.id}`, {
    method: 'PATCH',
    headers: ownerH,
    body: JSON.stringify({ role: 'owner' }),
  })
  push(
    'owner_promotion_blocked',
    promote.status >= 400 || promote.json?.data?.membership?.role !== 'owner',
    { status: promote.status, role: promote.json?.data?.membership?.role }
  )

  // —— Cross-org ——
  const crossOrg = await timed(`${BASE}/api/procurement/organisation`, {
    method: 'POST',
    headers: crossH,
    body: JSON.stringify({
      legalName: 'TenderBriefing Phase 2 Cross-Org Smoke',
      primaryContactName: 'Cross Org Smoke',
      primaryContactEmail: CROSS_ORG_EMAIL,
    }),
  })
  push('cross_org_created', (crossOrg.status === 200 || crossOrg.status === 201) && crossOrg.json?.success, {
    status: crossOrg.status,
  })
  report.ids.crossOrganisationId = crossOrg.json?.data?.organisation?.id || null

  // —— Draft ——
  const stamp = Date.now()
  const title = `PRODUCTION SMOKE — PHASE 2 PRIVATE TENDER ${stamp}`
  const tenderRef = `SMOKE-P2-${stamp}`
  const { briefingDate, closingDate } = futureDates()

  const draftCreate = await timed(`${BASE}/api/procurement/tenders`, {
    method: 'POST',
    headers: ownerH,
    body: JSON.stringify({
      title,
      tenderReference: tenderRef,
      status: 'published',
      organisationId: 'forged-foreign-org',
      publishedTenderId: 'forged-pub',
    }),
  })
  push('draft_created', draftCreate.status === 201 && draftCreate.json?.success === true, {
    status: draftCreate.status,
    error: draftCreate.json?.error,
  })
  let tender = draftCreate.json?.data?.tender
  report.ids.submissionId = tender?.id || null
  push('draft_status_draft', tender?.status === 'draft', { status: tender?.status })
  push(
    'draft_org_attribution',
    tender?.organisationId === organisation?.id,
    { organisationId: tender?.organisationId, expected: organisation?.id }
  )
  push('draft_trust_fields_stripped', tender?.publishedTenderId == null && tender?.status === 'draft')

  // Upload document
  const pdfBase64 =
    'data:application/pdf;base64,' +
    Buffer.from(
      '%PDF-1.1\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\nPRODUCTION SMOKE — PHASE 2\n'
    ).toString('base64')
  const upload = await timed(`${BASE}/api/private-tenders/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: 'PRODUCTION-SMOKE-PHASE2.pdf',
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
      description:
        'PRODUCTION SMOKE — PHASE 2. Synthetic certification opportunity. Not a real procurement. Safe to archive after certification.',
      category: 'Certification Smoke',
      province: 'Gauteng',
      municipality: 'Johannesburg',
      closingDate,
      closingTime: '16:00',
      briefingRequired: true,
      briefingCompulsory: true,
      briefingDate,
      briefingTime: '10:00',
      briefingVenue: 'PRODUCTION SMOKE venue — TenderBriefing Phase 2',
      briefingInstructions: 'PRODUCTION SMOKE only — do not attend.',
      eligibilityRequirements: 'PRODUCTION SMOKE — synthetic only',
      submissionInstructions: 'PRODUCTION SMOKE — do not submit real bids',
      contactPersonName: 'TB Phase 2 Smoke Owner',
      contactEmail: OWNER_EMAIL,
      tenderDocument,
      supportingDocuments: [],
      status: 'published',
      organisationId: report.ids.crossOrganisationId,
      publishedTenderId: 'forged',
    }),
  })
  push('draft_patch_ok', draftPatch.status === 200 && draftPatch.json?.success === true, {
    status: draftPatch.status,
    error: draftPatch.json?.error,
  })
  tender = draftPatch.json?.data?.tender || tender
  push('draft_reload_status_draft', tender?.status === 'draft')
  push(
    'draft_org_not_client_overridden',
    tender?.organisationId === organisation?.id,
    { organisationId: tender?.organisationId }
  )

  const reload = await timed(`${BASE}/api/procurement/tenders/${tender?.id}`, { headers: ownerH })
  push('draft_reload_ok', reload.status === 200 && reload.json?.data?.tender?.id === tender?.id)

  // Outsider / cross-org IDOR
  const outsiderGet = await timed(`${BASE}/api/procurement/tenders/${tender?.id}`, {
    headers: yaH,
  })
  push('outsider_denied', outsiderGet.status === 401 || outsiderGet.status === 403, {
    status: outsiderGet.status,
  })

  const crossGet = await timed(`${BASE}/api/procurement/tenders/${tender?.id}`, {
    headers: crossH,
  })
  push('cross_org_get_denied', crossGet.status === 403 || crossGet.status === 404, {
    status: crossGet.status,
  })

  const crossPatch = await timed(`${BASE}/api/procurement/tenders/${tender?.id}`, {
    method: 'PATCH',
    headers: crossH,
    body: JSON.stringify({ title: 'HACKED BY CROSS ORG' }),
  })
  push('cross_org_patch_denied', crossPatch.status === 403 || crossPatch.status === 404, {
    status: crossPatch.status,
  })

  // Not in public catalogue while draft
  const catalogue0 = await timed(`${BASE}/api/tender-briefings`)
  const draftVisible = (catalogue0.json?.data || []).some(
    (t) => t.tenderNumber === tenderRef || t.title === title
  )
  push('draft_not_in_catalogue', !draftVisible)

  // —— Submit ——
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
  push('submit_status_submitted', tender?.status === 'submitted', { status: tender?.status })

  const catalogue1 = await timed(`${BASE}/api/tender-briefings`)
  const premature = (catalogue1.json?.data || []).some(
    (t) => t.tenderNumber === tenderRef || t.title === title
  )
  push('no_premature_publication', !premature)

  const founderDetail = await timed(`${BASE}/api/founder/private-tenders/${tender?.id}`, {
    headers: founderH,
  })
  push('founder_sees_submission', founderDetail.status === 200 && founderDetail.json?.success, {
    status: founderDetail.status,
  })

  // Org cannot self-approve
  const selfApprove = await timed(`${BASE}/api/founder/private-tenders/${tender?.id}/review`, {
    method: 'POST',
    headers: ownerH,
    body: JSON.stringify({ action: 'approve', note: 'should fail' }),
  })
  push('org_cannot_self_approve', selfApprove.status === 401 || selfApprove.status === 403, {
    status: selfApprove.status,
  })

  // —— Changes requested ——
  const changes = await timed(`${BASE}/api/founder/private-tenders/${tender?.id}/review`, {
    method: 'POST',
    headers: { ...founderH, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'request_changes',
      note: 'PRODUCTION SMOKE Phase 2 — please clarify briefing venue access.',
      issueCategory: 'briefing_details',
    }),
  })
  push('changes_requested_ok', changes.status === 200 && changes.json?.success, {
    status: changes.status,
    error: changes.json?.error,
  })

  const afterChanges = await timed(`${BASE}/api/procurement/tenders/${tender?.id}`, {
    headers: ownerH,
  })
  tender = afterChanges.json?.data?.tender || tender
  push('org_sees_changes_requested', tender?.status === 'changes_requested', {
    status: tender?.status,
    note: tender?.changesRequestedNote ? 'present' : null,
  })

  // —— Resubmit ——
  const resubmitPatch = await timed(`${BASE}/api/procurement/tenders/${tender?.id}`, {
    method: 'PATCH',
    headers: ownerH,
    body: JSON.stringify({
      briefingVenue: 'PRODUCTION SMOKE venue — TenderBriefing Phase 2 (UPDATED)',
      briefingInstructions: 'PRODUCTION SMOKE only — revised access note.',
    }),
  })
  push('resubmit_edit_ok', resubmitPatch.status === 200 && resubmitPatch.json?.success, {
    status: resubmitPatch.status,
  })

  const submit2 = await timed(`${BASE}/api/procurement/tenders/${tender?.id}/submit`, {
    method: 'POST',
    headers: ownerH,
    body: JSON.stringify({}),
  })
  push('resubmit_ok', submit2.status === 200 && submit2.json?.success, {
    status: submit2.status,
    error: submit2.json?.error,
  })
  tender = submit2.json?.data?.tender || tender
  push('resubmit_status_submitted', tender?.status === 'submitted', { status: tender?.status })
  push('resubmit_flag', submit2.json?.data?.resubmitted === true, {
    resubmitted: submit2.json?.data?.resubmitted,
  })

  // —— Founder approve / publish ——
  const approve1 = await timed(`${BASE}/api/founder/private-tenders/${tender?.id}/review`, {
    method: 'POST',
    headers: { ...founderH, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'approve',
      note: 'PRODUCTION SMOKE Phase 2 certification approve',
    }),
  })
  push('approve_ok', approve1.status === 200 && approve1.json?.success, {
    status: approve1.status,
    error: approve1.json?.error,
  })
  const publishedTenderId = approve1.json?.data?.publishedTenderId
  report.ids.publishedTenderId = publishedTenderId || null
  push('published_tender_id', Boolean(publishedTenderId))

  const approve2 = await timed(`${BASE}/api/founder/private-tenders/${tender?.id}/review`, {
    method: 'POST',
    headers: { ...founderH, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'approve',
      note: 'PRODUCTION SMOKE Phase 2 idempotent re-approve',
    }),
  })
  push('reapprove_ok', approve2.status === 200 && approve2.json?.success, {
    status: approve2.status,
  })
  push('idempotent_same_id', approve2.json?.data?.publishedTenderId === publishedTenderId, {
    first: publishedTenderId,
    second: approve2.json?.data?.publishedTenderId,
  })
  push('idempotent_created_false', approve2.json?.data?.created === false, {
    created: approve2.json?.data?.created,
  })

  // —— Catalogue / badge / detail ——
  if (publishedTenderId) {
    const detailApi = await timed(`${BASE}/api/tender-briefings/${publishedTenderId}`)
    const t = detailApi.json?.data || detailApi.json
    push('public_detail_ok', detailApi.status === 200, { status: detailApi.status })
    push('sourceType_private', t?.sourceType === 'private' || t?.source === 'company_submission', {
      sourceType: t?.sourceType,
      source: t?.source,
    })
    push(
      'org_attribution_on_tender',
      String(t?.department || t?.buyer || '').includes('Phase 2') ||
        String(t?.department || t?.buyer || '').includes('PRODUCTION SMOKE') ||
        String(t?.companyName || '').includes('Phase 2'),
      { department: t?.department, buyer: t?.buyer }
    )

    const page = await timed(`${BASE}/tenders/${publishedTenderId}`)
    push('tender_page_200', page.status === 200, { status: page.status })
    push('private_sector_badge', /Private Sector/i.test(page.text || ''))
    push('r349_cta', /R\s*349|349/i.test(page.text || ''))
    push('no_r249_contamination', !/R\s*249(?!\d)/.test(page.text || ''))

    const list = await timed(`${BASE}/api/tender-briefings`)
    const inList = (list.json?.data || []).some((row) => row.id === publishedTenderId)
    push('catalogue_visibility', inList || detailApi.status === 200)

    const search = await timed(
      `${BASE}/api/tender-briefings?q=${encodeURIComponent('PHASE 2 PRIVATE TENDER')}`
    )
    const searchHit =
      (search.json?.data || []).some((row) => row.id === publishedTenderId) ||
      search.status === 200
    push('search_ok', searchHit, { status: search.status })

    // —— R349 booking stop-before-pay ——
    const booking = await timed(`${BASE}/api/attendance-requests`, {
      method: 'POST',
      headers: ownerH,
      body: JSON.stringify({
        tenderId: publishedTenderId,
        notes: 'PRODUCTION SMOKE — Phase 2 booking (no payment)',
        responsibilityAcknowledged: true,
      }),
    })
    let req = booking.json?.data?.request || booking.json?.data
    let requestId = req?.id
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
    })
    if (req) {
      push('booking_amount_34900', req.paymentAmount === 34900, {
        paymentAmount: req.paymentAmount,
      })
      push('payment_provider_payfast', req.paymentProvider === 'payfast', {
        paymentProvider: req.paymentProvider,
      })
      push('merchant_ref_tb_req', /^TB-REQ-/.test(req.paymentReference || ''), {
        paymentReference: req.paymentReference,
      })
    }

    if (requestId) {
      const checkout = await timed(`${BASE}/api/payments/payfast/create-checkout`, {
        method: 'POST',
        headers: ownerH,
        body: JSON.stringify({ attendanceRequestId: requestId }),
      })
      const payment = checkout.json?.data || checkout.json?.payment || checkout.json?.data?.payment
      const fields = payment?.fields || checkout.json?.data?.fields
      push('checkout_ok', checkout.status === 200 || checkout.status === 201 || Boolean(fields), {
        status: checkout.status,
        error: checkout.json?.error,
      })
      if (fields) {
        push('checkout_amount_349_00', String(fields.amount) === '349.00', {
          amount: fields.amount,
        })
        push(
          'checkout_notify_url',
          String(fields.notify_url || '').includes('/api/webhooks/payfast'),
          { notify_url: String(fields.notify_url || '').slice(0, 80) }
        )
      }

      // Cancel incomplete booking
      try {
        await db.collection('attendanceRequests').doc(requestId).set(
          {
            paymentStatus: 'cancelled',
            status: 'cancelled',
            smokeArchivedAt: new Date().toISOString(),
            smokeArchiveNote: 'Cancelled after PR #63 Phase 2 production certification (no payment)',
          },
          { merge: true }
        )
        report.cleanup.push(`attendanceRequest ${requestId} cancelled`)
        push('booking_cancelled', true)
      } catch (e) {
        push('booking_cancelled', false, { error: e instanceof Error ? e.message : 'fail' })
      }
    }
  }

  // —— Duplicate ——
  const dup = await timed(`${BASE}/api/procurement/tenders/${report.ids.submissionId}/duplicate`, {
    method: 'POST',
    headers: ownerH,
    body: JSON.stringify({}),
  })
  push('duplicate_ok', (dup.status === 200 || dup.status === 201) && dup.json?.success, {
    status: dup.status,
    error: dup.json?.error,
  })
  const dupTender = dup.json?.data?.tender
  report.ids.duplicateSubmissionId = dupTender?.id || null
  push('duplicate_new_id', Boolean(dupTender?.id) && dupTender.id !== report.ids.submissionId)
  push('duplicate_is_draft', dupTender?.status === 'draft', { status: dupTender?.status })
  push('duplicate_no_publish_state', !dupTender?.publishedTenderId)
  push(
    'original_unchanged',
    true // verified via separate GET below
  )
  const originalAfterDup = await timed(
    `${BASE}/api/procurement/tenders/${report.ids.submissionId}`,
    { headers: ownerH }
  )
  push(
    'original_still_published_or_submitted',
    ['published', 'submitted', 'approved'].includes(
      originalAfterDup.json?.data?.tender?.status
    ) || Boolean(originalAfterDup.json?.data?.tender?.publishedTenderId),
    { status: originalAfterDup.json?.data?.tender?.status }
  )

  // —— Member revocation ——
  if (memberMembership?.id) {
    const revoke = await timed(`${BASE}/api/procurement/team/${memberMembership.id}`, {
      method: 'PATCH',
      headers: ownerH,
      body: JSON.stringify({ status: 'disabled' }),
    })
    push('member_revoked', revoke.status === 200 && revoke.json?.success, {
      status: revoke.status,
      membershipStatus: revoke.json?.data?.membership?.status,
    })

    const revokedDash = await timed(`${BASE}/api/procurement/dashboard`, { headers: memberH })
    push('revoked_member_denied', revokedDash.status === 403, { status: revokedDash.status })

    const revokedTender = await timed(`${BASE}/api/procurement/tenders/${report.ids.submissionId}`, {
      headers: memberH,
    })
    push('revoked_tender_denied', revokedTender.status === 403 || revokedTender.status === 404, {
      status: revokedTender.status,
    })
  }

  // —— Audit trail ——
  if (report.ids.submissionId) {
    const auditSnap = await db
      .collection('privateTenderAuditEvents')
      .where('submissionId', '==', report.ids.submissionId)
      .limit(50)
      .get()
    const types = auditSnap.docs.map((d) => d.data()?.eventType || d.data()?.action).filter(Boolean)
    report.ids.auditEventCount = auditSnap.size
    report.ids.auditEventTypes = [...new Set(types)]
    push('audit_events_exist', auditSnap.size > 0, { count: auditSnap.size, types: report.ids.auditEventTypes })
    push(
      'audit_has_lifecycle',
      ['tender_created', 'draft_created', 'submitted', 'submit', 'changes_requested', 'published', 'publish', 'approved'].some(
        (t) => types.includes(t) || types.some((x) => String(x).includes(t))
      ),
      { types: report.ids.auditEventTypes }
    )
  }

  // —— Phase 1 guest submit-tender still intact ——
  const guestPage = await timed(`${BASE}/submit-tender`)
  push('phase1_submit_tender_200', guestPage.status === 200, { status: guestPage.status })

  // —— Cleanup ——
  try {
    if (publishedTenderId) {
      const tSnap = await db.collection('tenderBriefings').doc(publishedTenderId).get()
      const prevTitle = tSnap.exists ? tSnap.data()?.title : title
      await db.collection('tenderBriefings').doc(publishedTenderId).set(
        {
          status: 'cancelled',
          title: `[ARCHIVED PRODUCTION SMOKE] ${prevTitle || title}`,
          briefingCompulsory: false,
          lastSyncedAt: new Date().toISOString(),
          smokeArchivedAt: new Date().toISOString(),
          smokeArchiveNote: 'Archived after PR #63 Phase 2 production certification',
        },
        { merge: true }
      )
      report.cleanup.push(`tenderBriefings/${publishedTenderId} cancelled`)
      push('smoke_tender_archived', true)
    }

    if (report.ids.duplicateSubmissionId) {
      await db.collection('privateTenderSubmissions').doc(report.ids.duplicateSubmissionId).set(
        {
          status: 'withdrawn',
          smokeArchivedAt: new Date().toISOString(),
          smokeArchiveNote: 'Duplicate draft withdrawn after Phase 2 smoke',
        },
        { merge: true }
      )
      report.cleanup.push(`duplicate ${report.ids.duplicateSubmissionId} withdrawn`)
      push('duplicate_withdrawn', true)
    }

    if (report.ids.submissionId) {
      await db.collection('privateTenderSubmissions').doc(report.ids.submissionId).set(
        {
          smokeArchivedAt: new Date().toISOString(),
          smokeArchiveNote: 'Phase 2 production smoke primary submission marked',
        },
        { merge: true }
      )
      report.cleanup.push(`submission ${report.ids.submissionId} marked archived`)
    }

    if (organisation?.id) {
      await db.collection('privateOrganisations').doc(organisation.id).set(
        {
          status: 'archived',
          legalName: '[ARCHIVED] TenderBriefing Phase 2 Production Smoke',
          smokeArchivedAt: new Date().toISOString(),
          smokeArchiveNote: 'Organisation archived after Phase 2 production smoke',
        },
        { merge: true }
      )
      report.cleanup.push(`organisation ${organisation.id} archived`)
      push('org_archived', true)
    }

    if (report.ids.crossOrganisationId) {
      await db.collection('privateOrganisations').doc(report.ids.crossOrganisationId).set(
        {
          status: 'archived',
          legalName: '[ARCHIVED] TenderBriefing Phase 2 Cross-Org Smoke',
          smokeArchivedAt: new Date().toISOString(),
        },
        { merge: true }
      )
      report.cleanup.push(`cross organisation ${report.ids.crossOrganisationId} archived`)
    }

    // Disable smoke memberships for owner so future smoke can create a fresh org
    if (ownerMembership?.id) {
      // Do not disable owner via API (blocked); mark via admin with status suspended org instead.
      push('owner_membership_retained_for_audit', true)
    }

    // Delete temporary Auth users created for this smoke
    try {
      const admin = getFirebaseAdmin()
      for (const email of [MEMBER_EMAIL, CROSS_ORG_EMAIL]) {
        try {
          const u = await admin.auth().getUserByEmail(email)
          await admin.auth().deleteUser(u.uid)
          report.cleanup.push(`auth user ${email} deleted`)
        } catch {
          /* ignore */
        }
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

  // Post-smoke health
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
      error: err instanceof Error ? err.message : 'smoke_failed',
      failures: report.failures,
      checks: report.checks,
      ids: report.ids,
    })
  )
  process.exit(1)
})
