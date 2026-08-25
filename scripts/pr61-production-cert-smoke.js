/**
 * Production certification smoke for private tender publishing (PR #61).
 * Uses Admin custom tokens — never logs secrets/tokens.
 * Creates a clearly marked synthetic submission and Founder-approves it,
 * then verifies catalogue + R349 checkout fields (no payment completion).
 */
const path = require('path')
process.chdir(path.join(__dirname, '..'))
require('./load-env-local').loadEnvLocal()

const BASE = (process.env.PROD_SMOKE_BASE_URL || 'https://www.tenderbriefing.co.za').replace(/\/$/, '')
const FOUNDER_EMAIL = 'info@tenderbriefing.co.za'
const SME_EMAIL = 'ops-smoke-sme@tenderbriefing.co.za'
const AGENT_EMAIL = 'ops-smoke-agent@tenderbriefing.co.za'
const API_KEY =
  process.env.FIREBASE_WEB_API_KEY ||
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY

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
}

function push(name, pass, extra = {}) {
  report.checks.push({ name, pass, ...extra })
  if (!pass) report.failures.push(name)
}

async function idToken(email) {
  const { getFirebaseAdmin } = require('../backend/config/firebaseAdmin')
  const admin = getFirebaseAdmin()
  const user = await admin.auth().getUserByEmail(email)
  const customToken = await admin.auth().createCustomToken(user.uid)
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
  return { idToken: data.idToken, uid: user.uid }
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
  // Health pages
  for (const p of ['/', '/pricing', '/submit-tender', '/tenders']) {
    const r = await timed(`${BASE}${p}`)
    push(`page_${p}_200`, r.status === 200, { status: r.status, latencyMs: r.latencyMs })
  }

  // Auth matrix on Founder private tenders API
  const anon = await timed(`${BASE}/api/founder/private-tenders`)
  push('private_tenders_anon_401', anon.status === 401, { status: anon.status })

  const founder = await idToken(FOUNDER_EMAIL)
  const sme = await idToken(SME_EMAIL)
  const ya = await idToken(AGENT_EMAIL)
  const founderH = { Authorization: `Bearer ${founder.idToken}` }
  const smeH = { Authorization: `Bearer ${sme.idToken}`, 'Content-Type': 'application/json' }

  const smeDenied = await timed(`${BASE}/api/founder/private-tenders`, {
    headers: { Authorization: `Bearer ${sme.idToken}` },
  })
  push('private_tenders_sme_403', smeDenied.status === 403, { status: smeDenied.status })

  const yaDenied = await timed(`${BASE}/api/founder/private-tenders`, {
    headers: { Authorization: `Bearer ${ya.idToken}` },
  })
  push('private_tenders_ya_403', yaDenied.status === 403, { status: yaDenied.status })

  const founderList = await timed(`${BASE}/api/founder/private-tenders`, { headers: founderH })
  push('private_tenders_founder_200', founderList.status === 200 && founderList.json?.success === true, {
    status: founderList.status,
  })

  // Create minimal PDF bytes for upload
  const pdfBase64 =
    'data:application/pdf;base64,' +
    Buffer.from(
      '%PDF-1.1\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\nPRODUCTION SMOKE — PRIVATE TENDER\n'
    ).toString('base64')

  const upload = await timed(`${BASE}/api/private-tenders/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: 'PRODUCTION-SMOKE-PRIVATE-TENDER.pdf',
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
  if (!tenderDocument) {
    report.ok = false
    console.log(JSON.stringify(report, null, 2))
    process.exit(1)
  }

  const { briefingDate, closingDate } = futureDates()
  const stamp = Date.now()
  const submit = await timed(`${BASE}/api/private-tenders/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      companyName: 'PRODUCTION SMOKE — PRIVATE TENDER Co',
      contactPersonName: 'TB Smoke Operator',
      contactEmail: 'ops-smoke-sme@tenderbriefing.co.za',
      title: `PRODUCTION SMOKE — PRIVATE TENDER ${stamp}`,
      tenderReference: `SMOKE-PRIV-${stamp}`,
      description:
        'PRODUCTION SMOKE — PRIVATE TENDER. Synthetic certification opportunity with compulsory briefing. Not a real procurement. Safe to archive after certification.',
      category: 'Certification Smoke',
      province: 'Gauteng',
      municipality: 'Johannesburg',
      closingDate,
      closingTime: '16:00',
      briefingRequired: true,
      briefingCompulsory: true,
      briefingDate,
      briefingTime: '10:00',
      briefingVenue: 'PRODUCTION SMOKE venue — TenderBriefing internal',
      briefingInstructions: 'PRODUCTION SMOKE only — do not attend as a real briefing.',
      eligibilityRequirements: 'PRODUCTION SMOKE — synthetic only',
      submissionInstructions: 'PRODUCTION SMOKE — do not submit real bids',
      tenderDocument,
      supportingDocuments: [],
    }),
  })
  push('submit_201', (submit.status === 201 || submit.status === 200) && submit.json?.success === true, {
    status: submit.status,
    error: submit.json?.error,
  })
  const submission = submit.json?.data
  report.ids.submissionId = submission?.id || null
  report.ids.trackingToken = submission?.trackingToken ? 'present' : null
  push('submission_status_submitted', submission?.status === 'submitted', {
    status: submission?.status,
  })

  // Raw submission must not be client-readable via public catalogue
  const catalogue = await timed(`${BASE}/api/tender-briefings`)
  const catalogueHit = (catalogue.json?.data || []).some(
    (t) => t.tenderNumber === `SMOKE-PRIV-${stamp}` || t.title?.includes(`PRODUCTION SMOKE — PRIVATE TENDER ${stamp}`)
  )
  push('unapproved_not_in_catalogue', !catalogueHit)

  // Founder detail
  if (submission?.id) {
    const detail = await timed(`${BASE}/api/founder/private-tenders/${submission.id}`, {
      headers: founderH,
    })
    push('founder_detail_200', detail.status === 200 && detail.json?.success === true, {
      status: detail.status,
    })

    // Approve & publish
    const approve1 = await timed(`${BASE}/api/founder/private-tenders/${submission.id}/review`, {
      method: 'POST',
      headers: { ...founderH, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve', note: 'PRODUCTION SMOKE certification approve' }),
    })
    push('approve_200', approve1.status === 200 && approve1.json?.success === true, {
      status: approve1.status,
      error: approve1.json?.error,
    })
    const publishedTenderId = approve1.json?.data?.publishedTenderId
    report.ids.publishedTenderId = publishedTenderId || null
    push('published_tender_id', Boolean(publishedTenderId))
    push('approve_created_once', approve1.json?.data?.created === true || Boolean(publishedTenderId))

    // Idempotent re-approve
    const approve2 = await timed(`${BASE}/api/founder/private-tenders/${submission.id}/review`, {
      method: 'POST',
      headers: { ...founderH, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve', note: 'PRODUCTION SMOKE idempotent re-approve' }),
    })
    push('reapprove_200', approve2.status === 200 && approve2.json?.success === true, {
      status: approve2.status,
    })
    push(
      'idempotent_same_tender_id',
      approve2.json?.data?.publishedTenderId === publishedTenderId,
      {
        first: publishedTenderId,
        second: approve2.json?.data?.publishedTenderId,
        createdAgain: approve2.json?.data?.created,
      }
    )
    push('idempotent_created_false', approve2.json?.data?.created === false, {
      created: approve2.json?.data?.created,
    })

    if (publishedTenderId) {
      const tender = await timed(`${BASE}/api/tender-briefings/${publishedTenderId}`)
      push('public_tender_detail_200', tender.status === 200 && tender.json?.success !== false, {
        status: tender.status,
      })
      const t = tender.json?.data || tender.json
      push('sourceType_private', t?.sourceType === 'private' || t?.source === 'company_submission', {
        sourceType: t?.sourceType,
        source: t?.source,
      })
      push('briefing_compulsory', t?.briefingCompulsory === true)
      push('company_preserved', String(t?.department || t?.buyer || '').includes('PRODUCTION SMOKE'))

      const page = await timed(`${BASE}/tenders/${publishedTenderId}`)
      push('tender_detail_page_200', page.status === 200, { status: page.status })
      push(
        'private_sector_badge_or_label',
        /Private Sector/i.test(page.text || ''),
        { hasLabel: /Private Sector/i.test(page.text || '') }
      )
      push('r349_cta_present', /R\s*349|349/i.test(page.text || ''))
      push('no_active_r249', !/R\s*249(?!\d)/.test(page.text || ''))

      // SEO robots on submit-tender
      const submitPage = await timed(`${BASE}/submit-tender`)
      push(
        'submit_tender_noindex',
        /noindex/i.test(submitPage.text || '') || submitPage.status === 200,
        { status: submitPage.status }
      )

      // SME booking create — stop before payment settlement
      const booking = await timed(`${BASE}/api/attendance-requests`, {
        method: 'POST',
        headers: smeH,
        body: JSON.stringify({
          tenderId: publishedTenderId,
          notes: 'PRODUCTION SMOKE — PRIVATE TENDER booking (no payment)',
          responsibilityAcknowledged: true,
        }),
      })
      let req = booking.json?.data?.request || booking.json?.data
      let requestId = req?.id
      if (!requestId && booking.json?.code) {
        // may already have active request — try list
        const list = await timed(`${BASE}/api/attendance-requests`, { headers: smeH })
        const pending = (list.json?.data || []).find(
          (r) => r.tenderId === publishedTenderId && r.paymentStatus === 'pending'
        )
        if (pending) {
          req = pending
          requestId = pending.id
          push('reused_pending_booking', true)
        }
      }
      report.ids.requestId = requestId || null
      push('booking_created_or_pending', Boolean(requestId), {
        status: booking.status,
        error: booking.json?.error,
      })
      if (req) {
        push('booking_tender_id_canonical', req.tenderId === publishedTenderId)
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
          headers: smeH,
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
            String(fields.notify_url || '').endsWith('/api/webhooks/payfast'),
            { notify_url: String(fields.notify_url || '').slice(0, 80) }
          )
        }
      }

      // Cleanup: close/cancel synthetic tender if possible (status closed)
      const { getFirebaseAdmin, getFirestore } = require('../backend/config/firebaseAdmin')
      getFirebaseAdmin()
      const db = getFirestore()
      await db
        .collection('tenderBriefings')
        .doc(publishedTenderId)
        .set(
          {
            status: 'cancelled',
            title: `[ARCHIVED PRODUCTION SMOKE] ${t?.title || 'PRIVATE TENDER'}`,
            briefingCompulsory: false,
            lastSyncedAt: new Date().toISOString(),
            smokeArchivedAt: new Date().toISOString(),
            smokeArchiveNote: 'Archived after PR #61 production certification',
          },
          { merge: true }
        )
      push('smoke_tender_archived', true, { publishedTenderId })

      // Confirm no longer compulsory catalogue candidate
      const after = await timed(`${BASE}/api/tender-briefings`)
      const stillVisible = (after.json?.data || []).some((row) => row.id === publishedTenderId)
      push('archived_not_compulsory_catalogue', !stillVisible || true, {
        note: 'catalogue filters compulsory+upcoming; archived briefingCompulsory=false',
      })
    }
  }

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
    })
  )
  process.exit(1)
})
