#!/usr/bin/env node
/**
 * Lightweight secret scan for committed files (not a substitute for gitleaks).
 */
const { execSync } = require('child_process')
const assert = require('assert')

const tracked = execSync('git ls-files', { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)

const banned = [
  /^\.env\.local$/,
  /^\.env$/,
  /credentials\.json$/i,
  /serviceAccount.*\.json$/i,
]

for (const f of tracked) {
  for (const re of banned) {
    assert.doesNotMatch(f, re, `secrets-scan: banned path tracked: ${f}`)
  }
}

const smoke = tracked.filter((f) => f.includes('production-smoke'))
for (const f of smoke) {
  const body = require('fs').readFileSync(f, 'utf8')
  assert.doesNotMatch(
    body,
    /TenderBriefing_Smoke2026!/,
    `secrets-scan: hardcoded smoke password in ${f}`
  )
}

console.log('secrets-scan-qa: all checks passed')
