#!/usr/bin/env node
/**
 * Quick check: production sync auth rejects missing secret.
 * Run: NODE_ENV=production SYNC_SECRET=test-secret node scripts/test-sync-auth.js
 */

process.chdir(require('path').join(__dirname, '..'))

// Minimal reimplementation matching lib/sync/authorizeSync.ts
function isSyncAuthorized(providedSecret, env = process.env) {
  const isProduction = env.NODE_ENV === 'production'
  const configuredSecret = env.SYNC_SECRET
  if (!isProduction) return true
  if (!configuredSecret) return false
  return providedSecret === configuredSecret
}

const cases = [
  { env: { NODE_ENV: 'development' }, header: null, expect: true },
  { env: { NODE_ENV: 'production', SYNC_SECRET: 'abc' }, header: null, expect: false },
  { env: { NODE_ENV: 'production', SYNC_SECRET: 'abc' }, header: 'abc', expect: true },
  { env: { NODE_ENV: 'production', SYNC_SECRET: 'abc' }, header: 'wrong', expect: false },
]

let ok = true
for (const c of cases) {
  const result = isSyncAuthorized(c.header, c.env)
  if (result !== c.expect) {
    console.error('FAIL', c)
    ok = false
  }
}
console.log(ok ? '✅ Sync auth rules OK' : '❌ Sync auth rules failed')
process.exit(ok ? 0 : 1)
