#!/usr/bin/env node
/**
 * Controlled production smoke for Founder Youth Agent Outreach V2.
 * ONE send only to authorised Founder-controlled inbox.
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
const CAMPAIGN_TYPE = 'youth_agent_invitation'

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

function writeTempXlsx(name, email) {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([
    ['Name', 'Email'],
    [name, email],
  ])
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  const filePath = path.join(os.tmpdir(), `founder-ya-outreach-smoke-${Date.now()}.xlsx`)
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

const SUPPRESSION_COLLECTION = 'emailSuppressions'

async function clearSuppressionIfNeeded(email) {
  process.env.STORAGE_ADAPTER = process.env.STORAGE_ADAPTER || 'firestore'
  const { getFirestore } = require('../backend/config/firebaseAdmin')
  const db = getFirestore()
  const normalised = String(email || '').trim().toLowerCase()
  const ref = db.collection(SUPPRESSION_COLLECTION).doc(normalised)
  const snap = await ref.get()
  if (!snap.exists) return { wasSuppressed: false, cleared: false, prior: null }
  const prior = snap.data()
  await ref.delete()
  return { wasSuppressed: true, cleared: true, prior }
}

async function restoreSuppression(email, prior) {
  if (!prior) return
  process.env.STORAGE_ADAPTER = process.env.STORAGE_ADAPTER || 'firestore'
  const { getFirestore } = require('../backend/config/firebaseAdmin')
  const db = getFirestore()
  const normalised = String(email || '').trim().toLowerCase()
  await db.collection(SUPPRESSION_COLLECTION).doc(normalised).set(prior)
}

async function main() {
  const report = {
    base: BASE,
    campaignType: CAMPAIGN_TYPE,
    smokeEmailMasked: maskEmail(SMOKE_EMAIL),
    suppression: null,
    security: {},
    validate: null,
    send: null,
    delivery: null,
  }

  console.log('Founder Youth Agent Outreach production smoke')
  console.log(JSON.stringify({ base: BASE, recipient: report.smokeEmailMasked, campaignType: CAMPAIGN_TYPE }, null, 2))

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

  const pre = await founderFetch(founder.idToken, '/api/founder/outreach/campaigns')
  if (pre.status === 403 && pre.json?.code === 'flag_disabled') {
    console.error('FOUNDER_SME_OUTREACH_ENABLED is false in production.')
    console.log(JSON.stringify(report, null, 2))
    process.exit(2)
  }
  if (pre.status !== 200) {
    console.error('Founder campaigns list unexpected', pre.status, pre.text)
    process.exit(1)
  }

  report.suppression = await clearSuppressionIfNeeded(SMOKE_EMAIL)
  console.log('suppression prep', report.suppression)

  const xlsxPath = writeTempXlsx('Calvin', SMOKE_EMAIL)
  try {
    const fd = new FormData()
    const buf = fs.readFileSync(xlsxPath)
    fd.append(
      'file',
      new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      'founder-ya-outreach-smoke.xlsx'
    )
    fd.append('campaignType', CAMPAIGN_TYPE)

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
    const preview = validateJson.data.emailPreview
    report.validate = {
      id: redactId(c.id),
      campaignId: c.id,
      type: c.type,
      templateVersion: c.templateVersion,
      totalRows: c.totalRows,
      sendableRows: c.sendableRows,
      suppressedRows: c.suppressedRows,
      subject: preview?.subject,
      ctaLabel: preview?.ctaLabel,
      ctaUrl: preview?.ctaUrl,
      templateVersionPreview: preview?.templateVersion,
      campaignType: preview?.campaignType,
      audienceLabel: preview?.audienceLabel,
    }
    console.log('validate ok', report.validate)

    const expected = {
      subject: 'Invitation to become Youth Agents',
      ctaLabel: 'JOIN AS A YOUTH AGENT',
      ctaUrl: `${BASE}/auth/signup?type=youth-agent`,
      templateVersion: 'youth-agent-invitation-v1',
      type: 'youth_agent_invitation',
    }
    for (const [k, v] of Object.entries(expected)) {
      const got = k === 'type' ? c.type : preview?.[k === 'type' ? 'campaignType' : k] || c[k]
      if (got !== v) {
        console.error(`expected ${k}=${v} got ${got}`)
        process.exit(1)
      }
    }

    if (c.sendableRows !== 1) {
      console.error('expected sendableRows=1', c)
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
    report.send = {
      status: sendRes.status,
      sentThisTick: sendRes.json?.data?.sentThisTick,
      failedThisTick: sendRes.json?.data?.failedThisTick,
    }
    console.log('send tick', report.send)

    let detail = null
    for (let i = 0; i < 20; i++) {
      const d = await founderFetch(
        founder.idToken,
        `/api/founder/outreach/campaigns/${c.id}?preview=1`
      )
      detail = d.json?.data
      const st = detail?.campaign?.status
      console.log(`poll ${i}: status=${st} sent=${detail?.campaign?.sentCount}`)
      if (st === 'completed' || st === 'completed_with_failures' || st === 'failed') break
      await new Promise((r) => setTimeout(r, 2000))
    }

    const camp = detail?.campaign
    process.env.STORAGE_ADAPTER = process.env.STORAGE_ADAPTER || 'firestore'
    const { getFirestore } = require('../backend/config/firebaseAdmin')
    const db = getFirestore()
    const deliveries = await db
      .collection('founderOutreachCampaigns')
      .doc(c.id)
      .collection('deliveries')
      .get()
    const sentRow = deliveries.docs.map((d) => d.data()).find((d) => d.status === 'sent')
    report.delivery = {
      status: camp?.status,
      sentCount: camp?.sentCount,
      failedCount: camp?.failedCount,
      messageIdCaptured: Boolean(sentRow?.resendMessageId),
      messageIdRedacted: sentRow?.resendMessageId ? redactId(sentRow.resendMessageId) : null,
      subject: sentRow?.subject || null,
    }
    console.log('delivery', report.delivery)

    if (camp?.sentCount !== 1) {
      console.error('send smoke did not reach sentCount=1')
      process.exit(1)
    }
  } finally {
    try {
      fs.unlinkSync(xlsxPath)
    } catch {
      /* ignore */
    }
    if (report.suppression?.wasSuppressed && report.suppression.prior) {
      await restoreSuppression(SMOKE_EMAIL, report.suppression.prior)
      console.log('suppression restored for test address')
    }
  }

  console.log('SMOKE_REPORT')
  console.log(JSON.stringify(report, null, 2))
  const ok =
    report.security.anonymous?.denied &&
    report.security.sme?.denied &&
    report.security.youth_agent?.denied &&
    report.delivery?.sentCount === 1 &&
    report.validate?.templateVersion === 'youth-agent-invitation-v1'
  process.exit(ok ? 0 : 1)
}

main().catch((err) => {
  console.error('smoke_fatal', err instanceof Error ? err.message : String(err))
  process.exit(1)
})
