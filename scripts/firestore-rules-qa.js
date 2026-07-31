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
  /match\s+\/agents\/\{agentId\}[\s\S]*?allow\s+create:\s*if\s+agentCreateAllowed\s*\(\s*agentId\s*\)/,
  'agents create must call agentCreateAllowed(agentId)'
)

// F01 — agent / agentVerification privileged-field denylist
assert.match(
  body,
  /function\s+agentOwnerUpdateAllowed\s*\(\s*agentId\s*\)/,
  'agentOwnerUpdateAllowed must exist'
)
assert.match(
  body,
  /function\s+agentVerificationCreateAllowed\s*\(\s*agentId\s*\)/,
  'agentVerificationCreateAllowed must exist'
)
assert.match(
  body,
  /function\s+agentVerificationOwnerUpdateAllowed\s*\(\s*agentId\s*\)/,
  'agentVerificationOwnerUpdateAllowed must exist'
)
assert.match(
  body,
  /allow\s+update:\s*if\s+isAdmin\(\)\s*\|\|\s+agentOwnerUpdateAllowed\s*\(\s*agentId\s*\)/,
  'agents update must use agentOwnerUpdateAllowed denylist'
)
assert.match(
  body,
  /agentOwnerUpdateAllowed[\s\S]*?verificationStatus/,
  'agentOwnerUpdateAllowed must deny verificationStatus changes'
)
assert.match(
  body,
  /agentOwnerUpdateAllowed[\s\S]*?reliabilityScore/,
  'agentOwnerUpdateAllowed must deny reliabilityScore changes'
)
assert.match(
  body,
  /agentVerificationOwnerUpdateAllowed[\s\S]*?adminApproved/,
  'agentVerification owner update must deny adminApproved'
)
assert.match(
  body,
  /agentVerificationCreateAllowed[\s\S]*?status\s*==\s*'pending'/,
  'agentVerification create must force pending status'
)

// Must not allow unrestricted youth-agent self-update on agents.
assert.doesNotMatch(
  body,
  /match\s+\/agents\/\{agentId\}[\s\S]*?allow\s+update:\s*if\s+isAdmin\(\)\s*\|\|\s*\(\s*isYouthAgent\(\)\s*&&\s*request\.auth\.uid\s*==\s*agentId\s*\)\s*;/,
  'agents must not allow unrestricted youth-agent self-update'
)

// Attendance privileged fields — client must not escalate payment/assignment/status.
assert.match(
  body,
  /function\s+attendancePrivilegedKeysUnchanged\s*\(\s*\)/,
  'attendancePrivilegedKeysUnchanged must exist'
)
assert.match(
  body,
  /attendancePrivilegedKeysUnchanged[\s\S]*?paymentStatus/,
  'attendance privileged denylist must include paymentStatus'
)
assert.match(
  body,
  /match\s+\/attendanceRequests\/\{requestId\}[\s\S]*?attendancePrivilegedKeysUnchanged\s*\(\s*\)/,
  'attendanceRequests updates must require attendancePrivilegedKeysUnchanged()'
)
assert.match(
  body,
  /match\s+\/auditLogs\/\{logId\}[\s\S]*?allow\s+write:\s*if\s+false/,
  'auditLogs must deny client writes'
)

// F02 — Firestore emulator security matrix (Phase 1) regression guards.
// These pair with tests/firestore/rules.idor.test.ts, which exercises the
// same rules dynamically against the emulator; these are cheap static
// tripwires that don't need Java/the emulator to run.
assert.match(
  body,
  /match\s+\/users\/\{userId\}[\s\S]{0,200}allow\s+read:\s*if\s+isAuthenticated\(\)\s*&&\s*\(\s*request\.auth\.uid\s*==\s*userId\s*\|\|\s*isAdmin\(\)\s*\)/,
  'users read must remain scoped to owner or admin'
)
assert.match(
  body,
  /match\s+\/briefingReports\/\{reportId\}[\s\S]*?allow\s+read:\s*if\s+isAdmin\(\)[\s\S]*?resource\.data\.agentId\s*==\s*request\.auth\.uid[\s\S]*?resource\.data\.smeId\s*==\s*request\.auth\.uid/,
  'briefingReports read must stay scoped to admin, owning agent, or owning SME'
)
const briefingReportsBlockMatch = body.match(
  /match\s+\/briefingReports\/\{reportId\}\s*\{([\s\S]*?)\n {4}\}/
)
assert.ok(briefingReportsBlockMatch, 'briefingReports match block must exist')
assert.doesNotMatch(
  briefingReportsBlockMatch[1],
  /allow\s+(read|write|update|delete):\s*if\s+isAuthenticated\(\)\s*;/,
  'briefingReports must not regress to a blanket isAuthenticated() rule'
)
assert.match(
  body,
  /match\s+\/attendanceRequests\/\{requestId\}[\s\S]*?allow\s+read:\s*if\s+isAdmin\(\)/,
  'attendanceRequests read must require admin or an ownership/notification check (never open to any authenticated user)'
)

// firebase.json must declare a Firestore emulator so
// `npm run test:firestore-rules-emulator` has something to connect to.
const firebaseJsonPath = path.join(__dirname, '..', 'firebase.json')
const firebaseJson = JSON.parse(fs.readFileSync(firebaseJsonPath, 'utf8'))
assert.ok(
  firebaseJson.emulators && firebaseJson.emulators.firestore && Number.isInteger(firebaseJson.emulators.firestore.port),
  'firebase.json must declare emulators.firestore.port for the rules-unit-testing suite'
)

console.log('firestore-rules-qa: all checks passed')
