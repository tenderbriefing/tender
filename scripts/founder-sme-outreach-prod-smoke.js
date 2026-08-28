#!/usr/bin/env node
/**
 * Controlled production smoke for Founder SME Outreach V1.
 *
 * Requires:
 *   FOUNDER_OUTREACH_PROD_SMOKE=1
 *   FOUNDER_OUTREACH_SMOKE_EMAIL=<authorised Founder-controlled inbox>
 *
 * Optional:
 *   FOUNDER_SMOKE_BASE_URL (default https://www.tenderbriefing.co.za)
 *   SMOKE_TEST_PASSWORD or Firebase Admin credentials for Founder custom token
 *
 * Never logs full recipient email, tokens, or Resend API keys.
 * Does not commit the temporary .xlsx.
 */
const fs = require('fs')
const os = require('os')
const path = require('path')
const XLSX = require('xlsx')

process.chdir(path.join(__dirname, '..'))
try {
  require('./load-env-local').loadEnvLocal()
} catch {
  /* optional */
}

if (process.env.FOUNDER_OUTREACH_PROD_SMOKE !== '1') {
  console.error('Set FOUNDER_OUTREACH_PROD_SMOKE=1 to run this production smoke.')
  process.exit(1)
}

const BASE = (process.env.FOUNDER_SMOKE_BASE_URL || 'https://www.tenderbriefing.co.za').replace(
  /\/$/,
  ''
)
const FOUNDER_EMAIL = 'info@tenderbriefing.co.za'
const SME_EMAIL = 'ops-smoke-sme@tenderbriefing.co.za'
const AGENT_EMAIL = 'ops-smoke-agent@tenderbriefing.co.za'
const SMOKE_EMAIL = String(process.env.FOUNDER_OUTREACH_SMOKE_EMAIL || '')
  .trim()
  .toLowerCase()
const API_KEY =
  process.env.FIREBASE_WEB_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY || ''
const PASSWORD = process.env.SMOKE_TEST_PASSWORD

if (!SMOKE_EMAIL || !SMOKE_EMAIL.includes('@')) {
  console.error('FOUNDER_OUTREACH_SMOKE_EMAIL must be set to an authorised test address.')
  process.exit(1)
}
if (!API_KEY) {
  console.error('NEXT_PUBLIC_FIREBASE_API_KEY is required.')
  process.exit(1)
}

function maskEmail(email) {
  const [u, d] = String(email).split('@')
  if (!d) return '***'
  const user = u.length <= 2 ? `${u[0] || '*'}*` : `${u.slice(0, 2)}***`
  return `${user}@${d}`
}

function redactId(id) {
  const s = String(id || '')
  if (!s) return null
  if (s.length <= 8) return `${s.slice(0, 2)}…`
  return `${s.slice(0, 4)}…${s.slice(-4)}`
}

async function idTokenViaAdminCustomToken(email) {
  process.env.STORAGE_ADAPTER = process.env.STORAGE_ADAPTER || 'firestore'
  process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'tenderbriefing-34679'
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
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(`custom_token_exchange_failed:${data.error?.message || res.status}`)
  }
  return { ok: true, idToken: data.idToken, uid: data.localId || user.uid, source: 'admin_custom' }
}

async function signInToken(email) {
  if (PASSWORD) {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(API_KEY)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }),
      }
    )
    const data = await res.json().catch(() => ({}))
    if (res.ok) return { ok: true, idToken: data.idToken, uid: data.localId, source: 'password' }
  }
  return idTokenViaAdminCustomToken(email)
}

function writeTempXlsx(name, company, email) {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([
    ['Name', 'Company Name', 'Email'],
    [name, company, email],
  ])
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  const filePath = path.join(
    os.tmpdir(),
    `founder-outreach-smoke-${Date.now()}.xlsx`
  )
  XLSX.writeFile(wb, filePath)
  return filePath
}

async function founderFetch(idToken, pathname, options = {}) {
  const res = await fetch(`${BASE}${pathname}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${idToken}`,
    },
  })
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    /* ignore */
  }
  return { status: res.status, json, text: text.slice(0, 400) }
}

function unsubSecret(env = process.env) {
  return (
    (env.FOUNDER_OUTREACH_UNSUB_SECRET || '').trim() ||
    (env.SYNC_SECRET || '').trim() ||
    (env.AUTOMATION_SECRET || '').trim()
  )
}

function buildUnsubscribeToken(email, env = process.env) {
  const crypto = require('crypto')
  const secret = unsubSecret(env)
  if (!secret) return null
  const normalised = String(email || '')
    .trim()
    .toLowerCase()
  const sig = crypto.createHmac('sha256', secret).update(`unsub:v1:${normalised}`).digest('base64url')
  const payload = Buffer.from(JSON.stringify({ e: normalised, v: 1 }), 'utf8').toString('base64url')
  return `${payload}.${sig}`
}

async function main() {
  const report = {
    base: BASE,
    smokeEmailMasked: maskEmail(SMOKE_EMAIL),
    flagDisabledCheck: null,
    security: {},
    campaign1: null,
    send1: null,
    delivery1: null,
    unsub: null,
    campaign2: null,
    idempotentResend: null,
    history: null,
  }

  console.log('Founder SME Outreach production smoke')
  console.log(JSON.stringify({ base: BASE, recipient: report.smokeEmailMasked }, null, 2))

  // --- Security: anonymous / SME / agent denied ---
  for (const [label, email] of [
    ['anonymous', null],
    ['sme', SME_EMAIL],
    ['youth_agent', AGENT_EMAIL],
  ]) {
    let headers = {}
    if (email) {
      const auth = await signInToken(email)
      headers = { Authorization: `Bearer ${auth.idToken}` }
    }
    const res = await fetch(`${BASE}/api/founder/outreach/campaigns`, { headers })
    report.security[label] = { status: res.status, denied: res.status === 401 || res.status === 403 }
    console.log(`security ${label}: HTTP ${res.status}`)
  }

  const founder = await signInToken(FOUNDER_EMAIL)
  console.log(`founder auth: ${founder.source} uid=${redactId(founder.uid)}`)

  // If flag disabled, Founder should still get 403 flag_disabled
  const pre = await founderFetch(founder.idToken, '/api/founder/outreach/campaigns')
  report.flagDisabledCheck = {
    status: pre.status,
    code: pre.json?.code || null,
    error: pre.json?.error || null,
  }
  console.log(`founder campaigns probe: HTTP ${pre.status} code=${pre.json?.code || 'n/a'}`)

  if (pre.status === 403 && pre.json?.code === 'flag_disabled') {
    console.error(
      'FOUNDER_SME_OUTREACH_ENABLED is false in production. Enable flag and redeploy before send smoke.'
    )
    console.log(JSON.stringify(report, null, 2))
    process.exit(2)
  }
  if (pre.status !== 200) {
    console.error('Founder campaigns list unexpected', pre.status, pre.text)
    process.exit(1)
  }

  const xlsxPath = writeTempXlsx('Calvin', 'TenderBriefing Test', SMOKE_EMAIL)
  try {
    const fd = new FormData()
    const buf = fs.readFileSync(xlsxPath)
    fd.append('file', new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'founder-outreach-smoke.xlsx')

    const validateRes = await fetch(`${BASE}/api/founder/outreach/validate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${founder.idToken}` },
      body: fd,
    })
    const validateJson = await validateRes.json().catch(() => ({}))
    if (!validateRes.ok || !validateJson.success) {
      console.error('validate failed', validateRes.status, validateJson)
      process.exit(1)
    }
    const c = validateJson.data.campaign
    report.campaign1 = {
      id: redactId(c.id),
      campaignId: c.id,
      totalRows: c.totalRows,
      validRows: c.validRows,
      invalidRows: c.invalidRows,
      duplicateRows: c.duplicateRows,
      suppressedRows: c.suppressedRows,
      sendableRows: c.sendableRows,
      subject: validateJson.data.emailPreview?.subject,
      ctaLabel: validateJson.data.emailPreview?.ctaLabel,
      ctaUrl: validateJson.data.emailPreview?.ctaUrl,
    }
    console.log('validate ok', {
      totalRows: c.totalRows,
      sendableRows: c.sendableRows,
      suppressedRows: c.suppressedRows,
      subject: report.campaign1.subject,
      cta: report.campaign1.ctaLabel,
    })

    if (c.sendableRows !== 1 || c.invalidRows !== 0 || c.duplicateRows !== 0) {
      console.error('unexpected validate counts', report.campaign1)
      process.exit(1)
    }

    const sendRes = await founderFetch(
      founder.idToken,
      `/api/founder/outreach/campaigns/${c.id}/send`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmSend: true,
          authorisedList: true,
          confirmCount: 1,
        }),
      }
    )
    report.send1 = {
      status: sendRes.status,
      sentThisTick: sendRes.json?.data?.sentThisTick,
      failedThisTick: sendRes.json?.data?.failedThisTick,
    }
    console.log('send tick', report.send1)

    // Poll campaign until completed
    let detail = null
    for (let i = 0; i < 20; i++) {
      const d = await founderFetch(
        founder.idToken,
        `/api/founder/outreach/campaigns/${c.id}?preview=1`
      )
      detail = d.json?.data
      const st = detail?.campaign?.status
      console.log(`poll ${i}: status=${st} sent=${detail?.campaign?.sentCount} failed=${detail?.campaign?.failedCount}`)
      if (st === 'completed' || st === 'completed_with_failures' || st === 'failed') break
      await new Promise((r) => setTimeout(r, 2000))
    }

    const camp = detail?.campaign
    const failed = detail?.failed || []

    // Read delivery docs via Admin for Resend message ID (not exposed in UI API)
    process.env.STORAGE_ADAPTER = process.env.STORAGE_ADAPTER || 'firestore'
    const { getFirestore } = require('../backend/config/firebaseAdmin')
    const db = getFirestore()
    const deliveries = await db
      .collection('founderOutreachCampaigns')
      .doc(c.id)
      .collection('deliveries')
      .get()
    const deliveryRows = deliveries.docs.map((d) => d.data())
    const sentRow = deliveryRows.find((d) => d.status === 'sent')
    report.delivery1 = {
      status: camp?.status,
      sentCount: camp?.sentCount,
      failedCount: camp?.failedCount,
      queuedCount: camp?.queuedCount,
      messageIdCaptured: Boolean(sentRow?.resendMessageId),
      messageIdRedacted: sentRow?.resendMessageId ? redactId(sentRow.resendMessageId) : null,
      failedCodes: failed.map((f) => f.errorCode).filter(Boolean),
    }
    console.log('delivery', report.delivery1)

    if (camp?.sentCount !== 1 || camp?.failedCount !== 0) {
      console.error('send smoke did not reach sentCount=1')
      console.log(JSON.stringify(report, null, 2))
      process.exit(1)
    }

    // Idempotent re-confirm
    const again = await founderFetch(
      founder.idToken,
      `/api/founder/outreach/campaigns/${c.id}/send`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmSend: true,
          authorisedList: true,
          confirmCount: 1,
        }),
      }
    )
    report.idempotentResend = {
      status: again.status,
      sentThisTick: again.json?.data?.sentThisTick ?? null,
      processedThisTick: again.json?.data?.processedThisTick ?? null,
    }
    console.log('idempotent resend', report.idempotentResend)

    // Unsubscribe via token built with local secret (must match prod SYNC_SECRET)
    const token = buildUnsubscribeToken(SMOKE_EMAIL, process.env)
    if (!token) {
      console.error('Could not build unsubscribe token (missing FOUNDER_OUTREACH_UNSUB_SECRET/SYNC_SECRET)')
      process.exit(1)
    }
    const unsub1 = await fetch(
      `${BASE}/api/outreach/unsubscribe?token=${encodeURIComponent(token)}`
    )
    const unsub2 = await fetch(
      `${BASE}/api/outreach/unsubscribe?token=${encodeURIComponent(token)}`,
      { method: 'POST' }
    )
    report.unsub = {
      firstStatus: unsub1.status,
      secondStatus: unsub2.status,
      firstOk: unsub1.status === 200,
      secondOk: unsub2.status === 200,
    }
    console.log('unsubscribe', report.unsub)

    // Second campaign — expect suppressed
    const xlsx2 = writeTempXlsx('Calvin', 'TenderBriefing Test', SMOKE_EMAIL)
    try {
      const fd2 = new FormData()
      fd2.append(
        'file',
        new Blob([fs.readFileSync(xlsx2)], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
        'founder-outreach-smoke-2.xlsx'
      )
      const v2 = await fetch(`${BASE}/api/founder/outreach/validate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${founder.idToken}` },
        body: fd2,
      })
      const v2j = await v2.json().catch(() => ({}))
      report.campaign2 = {
        status: v2.status,
        sendableRows: v2j?.data?.campaign?.sendableRows ?? null,
        suppressedRows: v2j?.data?.campaign?.suppressedRows ?? null,
        error: v2j?.error || null,
        code: v2j?.code || null,
      }
      console.log('second validate (expect suppressed / zero sendable)', report.campaign2)
    } finally {
      try {
        fs.unlinkSync(xlsx2)
      } catch {
        /* ignore */
      }
    }

    const hist = await founderFetch(founder.idToken, '/api/founder/outreach/campaigns')
    report.history = {
      status: hist.status,
      count: hist.json?.data?.campaigns?.length ?? 0,
      latestStatus: hist.json?.data?.campaigns?.[0]?.status || null,
      latestSent: hist.json?.data?.campaigns?.[0]?.sentCount ?? null,
    }
    console.log('history', report.history)
  } finally {
    try {
      fs.unlinkSync(xlsxPath)
    } catch {
      /* ignore */
    }
  }

  console.log('SMOKE_REPORT')
  console.log(JSON.stringify(report, null, 2))
  const ok =
    report.security.anonymous?.denied &&
    report.security.sme?.denied &&
    report.security.youth_agent?.denied &&
    report.delivery1?.sentCount === 1 &&
    report.unsub?.firstOk &&
    report.unsub?.secondOk &&
    (report.campaign2?.sendableRows === 0 ||
      report.campaign2?.suppressedRows >= 1 ||
      report.campaign2?.code === 'campaign_create_failed')
  process.exit(ok ? 0 : 1)
}

main().catch((err) => {
  console.error('smoke_fatal', err instanceof Error ? err.message : String(err))
  process.exit(1)
})
