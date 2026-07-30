#!/usr/bin/env node
/**
 * Static Firestore rules safety checks for registration helpers.
 * Catches the class of bug where path captures (userId) are referenced
 * inside top-level helpers without being passed as arguments.
 *
 * Run: node scripts/firestore-rules-qa.js
 */
const assert = require('assert')
const fs = require('fs')
const path = require('path')

const rulesPath = path.join(__dirname, '..', 'firestore.rules')
const rules = fs.readFileSync(rulesPath, 'utf8')

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
}

const body = stripComments(rules)

// Helpers that touch userId must declare it as a parameter.
assert.match(
  body,
  /function\s+userCreateAllowed\s*\(\s*userId\s*\)/,
  'userCreateAllowed must take userId as a parameter'
)
assert.match(
  body,
  /function\s+userOwnerUpdateAllowed\s*\(\s*userId\s*\)/,
  'userOwnerUpdateAllowed must take userId as a parameter'
)

// Match block must pass the path capture into those helpers.
assert.match(
  body,
  /allow\s+create:\s*if\s+userCreateAllowed\s*\(\s*userId\s*\)/,
  'users create must call userCreateAllowed(userId)'
)
assert.match(
  body,
  /allow\s+update:\s*if\s+userOwnerUpdateAllowed\s*\(\s*userId\s*\)/,
  'users update must call userOwnerUpdateAllowed(userId)'
)

// Reject the broken pattern: helper with empty params that references userId.
assert.doesNotMatch(
  body,
  /function\s+userCreateAllowed\s*\(\s*\)\s*\{[^}]*userId/,
  'userCreateAllowed() must not reference unbound userId'
)
assert.doesNotMatch(
  body,
  /function\s+userOwnerUpdateAllowed\s*\(\s*\)\s*\{[^}]*userId/,
  'userOwnerUpdateAllowed() must not reference unbound userId'
)

// SME / agent self-create must remain open for authenticated owners.
assert.match(
  body,
  /match\s+\/smes\/\{smeId\}[\s\S]*?allow\s+create:\s*if\s+isAuthenticated\(\)\s*&&\s*request\.auth\.uid\s*==\s*smeId/,
  'smes create must allow authenticated owner'
)
assert.match(
  body,
  /match\s+\/agents\/\{agentId\}[\s\S]*?allow\s+create:\s*if\s+isAuthenticated\(\)\s*&&\s*request\.auth\.uid\s*==\s*agentId/,
  'agents create must allow authenticated owner'
)

console.log('firestore-rules-qa: all checks passed')
