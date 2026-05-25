#!/usr/bin/env node
/**
 * Ensure ops-smoke-admin@tenderbriefing.co.za exists for production QA.
 * Writes password to .qa-smoke-admin.txt (gitignored). Does not log secrets.
 */
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { execSync, execFileSync } = require('child_process')

const ROOT = path.join(__dirname, '..')
process.chdir(ROOT)
require('./load-env-local').loadEnvLocal()

const EMAIL = 'ops-smoke-admin@tenderbriefing.co.za'
const DISPLAY_NAME = 'Ops Smoke Admin'
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'tenderbriefing-34679'
const PASSWORD_FILE = path.join(ROOT, '.qa-smoke-admin.txt')
const SA_KEY = path.join(ROOT, 'service-account.json')

function generatePassword() {
  return `${crypto.randomBytes(18).toString('base64url')}Aa1!`
}

function getAccessToken() {
  if (fs.existsSync(SA_KEY)) {
    try {
      execSync(
        `gcloud auth activate-service-account --key-file="${SA_KEY}" --project="${PROJECT_ID}"`,
        { stdio: 'ignore' }
      )
    } catch {
      /* already active */
    }
  }
  return execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim()
}

function curlJson(method, url, token, body) {
  const args = [
    '-sS',
    '-X',
    method,
    url,
    '-H',
    `Authorization: Bearer ${token}`,
    '-H',
    'Content-Type: application/json',
  ]
  if (body) args.push('-d', JSON.stringify(body))
  const out = execFileSync('curl', args, { encoding: 'utf8' })
  if (!out) return {}
  try {
    return JSON.parse(out)
  } catch {
    throw new Error(`Invalid JSON from ${url}: ${out.slice(0, 120)}`)
  }
}

function firestoreValue(v) {
  if (v === null || v === undefined) return { nullValue: null }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (typeof v === 'number') return { doubleValue: v }
  if (Array.isArray(v)) {
    return { arrayValue: { values: v.map((x) => firestoreValue(x)) } }
  }
  return { stringValue: String(v) }
}

function toFirestoreFields(obj) {
  const fields = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue
    fields[k] = firestoreValue(v)
  }
  return fields
}

async function ensureViaAdminSdk(password, existingFile) {
  const { getFirebaseAdmin } = require('../backend/config/firebaseAdmin')
  const { ensureSmokeRoleProfiles } = require('./smoke-test-profiles')
  const admin = getFirebaseAdmin()
  const db = admin.firestore()
  let uid
  let action

  try {
    const existing = await admin.auth().getUserByEmail(EMAIL)
    uid = existing.uid
    await admin.auth().updateUser(uid, { displayName: DISPLAY_NAME, password })
    action = existingFile ? 'reused_password_reset' : 'reused_password_rotated'
  } catch (e) {
    if (e.code !== 'auth/user-not-found') throw e
    const created = await admin.auth().createUser({
      email: EMAIL,
      password,
      displayName: DISPLAY_NAME,
      emailVerified: true,
    })
    uid = created.uid
    action = 'created'
  }

  await ensureSmokeRoleProfiles(db, {
    uid,
    email: EMAIL,
    displayName: DISPLAY_NAME,
    userType: 'admin',
    extra: { role: 'admin', phoneNumber: '+27720708467' },
  })

  return { uid, action }
}

function ensureViaRest(password, existingFile) {
  const token = getAccessToken()
  const base = `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}`

  let uid
  let action

  const query = curlJson('POST', `${base}/accounts:query`, token, {
    returnUserInfo: true,
    email: [EMAIL],
  })

  const user = query.users?.[0]
  if (user?.localId) {
    uid = user.localId
    curlJson('POST', `${base}/accounts:update`, token, {
      localId: uid,
      displayName: DISPLAY_NAME,
      password,
      emailVerified: true,
    })
    action = existingFile ? 'reused_password_reset' : 'reused_password_rotated'
  } else {
    const created = curlJson('POST', `${base}/accounts`, token, {
      email: EMAIL,
      password,
      displayName: DISPLAY_NAME,
      emailVerified: true,
    })
    uid = created.localId
    if (!uid) throw new Error(created.error?.message || 'Auth create failed')
    action = 'created'
  }

  const timestamp = new Date().toISOString()
  const doc = {
    uid,
    email: EMAIL,
    displayName: DISPLAY_NAME,
    role: 'admin',
    userType: 'admin',
    phoneNumber: '+27720708467',
    location: 'Gauteng',
    province: 'Gauteng',
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  const fields = toFirestoreFields(doc)
  const mask = Object.keys(doc)
    .map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
    .join('&')

  curlJson(
    'PATCH',
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}?${mask}`,
    token,
    { fields }
  )

  return { uid, action }
}

async function main() {
  const existingFile = fs.existsSync(PASSWORD_FILE)
    ? fs.readFileSync(PASSWORD_FILE, 'utf8').trim()
    : ''
  const password = existingFile.length >= 12 ? existingFile : generatePassword()

  let uid
  let action
  let via = 'admin-sdk'

  try {
    const result = await ensureViaAdminSdk(password, existingFile)
    uid = result.uid
    action = result.action
  } catch (sdkErr) {
    via = 'rest-gcloud'
    const result = ensureViaRest(password, existingFile)
    uid = result.uid
    action = result.action
  }

  fs.writeFileSync(PASSWORD_FILE, password, { mode: 0o600 })

  console.log(
    JSON.stringify(
      {
        ok: true,
        via,
        action,
        email: EMAIL,
        uid,
        passwordFile: '.qa-smoke-admin.txt',
      },
      null,
      2
    )
  )
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }))
  process.exit(1)
})
