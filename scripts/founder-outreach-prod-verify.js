#!/usr/bin/env node
/** Production validate-only verification for SME + Youth Agent outreach (no send). */
const fs = require('fs')
const os = require('os')
const path = require('path')
const XLSX = require('xlsx')

process.chdir(path.join(__dirname, '..'))
require('./load-env-local').loadEnvLocal()

const BASE = (process.env.FOUNDER_SMOKE_BASE_URL || 'https://www.tenderbriefing.co.za').replace(/\/$/, '')
const FOUNDER_EMAIL = 'info@tenderbriefing.co.za'
const API_KEY = process.env.FIREBASE_WEB_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY || ''

async function signIn() {
  process.env.STORAGE_ADAPTER = 'firestore'
  process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'tenderbriefing-34679'
  const { getFirebaseAdmin } = require('../backend/config/firebaseAdmin')
  const admin = getFirebaseAdmin()
  const user = await admin.auth().getUserByEmail(FOUNDER_EMAIL)
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
  return data.idToken
}

function writeXlsx(campaignType, email) {
  const wb = XLSX.utils.book_new()
  const rows =
    campaignType === 'youth_agent_invitation'
      ? [['Name', 'Email'], ['Preview', email]]
      : [['Name', 'Company Name', 'Email'], ['Preview', 'Example Co', email]]
  const ws = XLSX.utils.aoa_to_sheet(rows)
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  const p = path.join(os.tmpdir(), `verify-${campaignType}-${Date.now()}.xlsx`)
  XLSX.writeFile(wb, p)
  return p
}

async function validate(idToken, campaignType) {
  const p = writeXlsx(campaignType, 'preview-only@example.com')
  try {
    const fd = new FormData()
    fd.append('file', new Blob([fs.readFileSync(p)]), 'verify.xlsx')
    fd.append('campaignType', campaignType)
    const res = await fetch(`${BASE}/api/founder/outreach/validate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}` },
      body: fd,
    })
    const json = await res.json()
    return { status: res.status, ok: res.ok && json.success, preview: json.data?.emailPreview, campaign: json.data?.campaign }
  } finally {
    fs.unlinkSync(p)
  }
}

async function main() {
  const idToken = await signIn()
  const sme = await validate(idToken, 'sme_invitation')
  const ya = await validate(idToken, 'youth_agent_invitation')
  const report = {
    sme: {
      status: sme.status,
      templateVersion: sme.preview?.templateVersion,
      subject: sme.preview?.subject,
      ctaLabel: sme.preview?.ctaLabel,
      audienceLabel: sme.preview?.audienceLabel,
    },
    youthAgent: {
      status: ya.status,
      templateVersion: ya.preview?.templateVersion,
      subject: ya.preview?.subject,
      ctaLabel: ya.preview?.ctaLabel,
      ctaUrl: ya.preview?.ctaUrl,
      audienceLabel: ya.preview?.audienceLabel,
      textExcerpt: ya.preview?.textExcerpt?.slice(0, 120),
    },
  }
  console.log(JSON.stringify(report, null, 2))
  const ok =
    sme.preview?.templateVersion === 'sme-invitation-v1' &&
    sme.preview?.subject === 'Compulsory briefings, without the travel' &&
    ya.preview?.templateVersion === 'youth-agent-invitation-v1' &&
    ya.preview?.subject === 'Invitation to become Youth Agents' &&
    ya.preview?.ctaUrl?.includes('/auth/signup?type=youth-agent')
  process.exit(ok ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
