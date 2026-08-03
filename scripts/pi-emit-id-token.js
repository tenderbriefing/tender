#!/usr/bin/env node
/** Emit idToken for email argv[2]; requires API_KEY env. No secrets logged. */
process.chdir(require('path').join(__dirname, '..'))
require('./load-env-local').loadEnvLocal()
const email = process.argv[2]
const apiKey = process.env.API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY
if (!email || !apiKey) {
  console.error('usage')
  process.exit(1)
}
// Silence Firebase Admin banner so stdout is token-only.
const origLog = console.log
console.log = (...args) => {
  const s = args.map(String).join(' ')
  if (s.includes('[Firebase Admin]')) return
  origLog(...args)
}
const { getFirebaseAdmin } = require('../backend/config/firebaseAdmin')
;(async () => {
  const a = getFirebaseAdmin()
  const u = await a.auth().getUserByEmail(email)
  const custom = await a.auth().createCustomToken(u.uid)
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: custom, returnSecureToken: true }),
    }
  )
  const d = await res.json()
  if (!res.ok) throw new Error(d.error?.message || String(res.status))
  process.stdout.write(d.idToken)
})().catch((e) => {
  console.error(String(e.message || e).slice(0, 160))
  process.exit(1)
})
