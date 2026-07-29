#!/usr/bin/env node
/**
 * Trigger a Firebase password-reset email for an existing Auth user.
 * Uses client Identity Toolkit sendOobCode (same path as the app) and
 * verifies the user via Admin SDK first. Does not print passwords or full links.
 *
 * Usage: node scripts/send-password-reset.js [email]
 */
const path = require('path')

const ROOT = path.join(__dirname, '..')
process.chdir(ROOT)
require('./load-env-local').loadEnvLocal()

const EMAIL = (process.argv[2] || 'info@tenderbriefing.co.za').trim().toLowerCase()
const CONTINUE_URL = 'https://www.tenderbriefing.co.za/auth/signin'
const apiKey =
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyDk_QBzmOXJfdl4PPqycoKtecGu0ioCRuY'

async function main() {
  if (!EMAIL || !EMAIL.includes('@')) {
    throw new Error('Provide a valid email, e.g. node scripts/send-password-reset.js user@example.com')
  }

  const { getFirebaseAdmin } = require('../backend/config/firebaseAdmin')
  const admin = getFirebaseAdmin()

  let uid
  try {
    const user = await admin.auth().getUserByEmail(EMAIL)
    uid = user.uid
    console.log(`User found: ${EMAIL} (uid ${uid.slice(0, 8)}…)`)
  } catch (err) {
    if (err && err.code === 'auth/user-not-found') {
      throw new Error(`No Firebase Auth user for ${EMAIL}. Cannot send reset email.`)
    }
    throw err
  }

  // Ensure link generation works (authorized continue URL + templates).
  const link = await admin.auth().generatePasswordResetLink(EMAIL, {
    url: CONTINUE_URL,
    handleCodeInApp: false,
  })
  if (!link || !link.includes('oobCode=')) {
    throw new Error('generatePasswordResetLink did not return a usable action link')
  }
  console.log('Admin generatePasswordResetLink: OK (link not printed)')

  const endpoint = `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requestType: 'PASSWORD_RESET',
      email: EMAIL,
      continueUrl: CONTINUE_URL,
    }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message = body.error?.message || JSON.stringify(body) || res.statusText
    throw new Error(`sendOobCode failed (${res.status}): ${message}`)
  }

  console.log(`Password reset email requested for ${EMAIL}`)
  console.log(`Continue URL: ${CONTINUE_URL}`)
  console.log('Check inbox + spam for the Firebase password reset message.')
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
