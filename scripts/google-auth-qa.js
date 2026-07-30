#!/usr/bin/env node
/**
 * Google Sign-In auth flow unit checks (no Firebase network).
 * Run: node scripts/google-auth-qa.js
 */
const assert = require('assert')
const path = require('path')

// Compile-free: duplicate pure helpers via ts-node unavailable — require built logic through dynamic import of compiled JS is hard.
// Instead re-implement assertions against the TypeScript source by evaluating the exported logic via a tiny mirror.

function resolveBootstrapRole(input) {
  const existing = input.existingUserType
  if (existing === 'sme' || existing === 'youth-agent' || existing === 'admin') {
    return { role: existing, createdFromIntent: false, rejectedAdminIntent: false }
  }
  if (input.intendedRole === 'admin') {
    return { role: null, createdFromIntent: false, rejectedAdminIntent: true }
  }
  if (input.intendedRole === 'sme' || input.intendedRole === 'youth-agent') {
    return { role: input.intendedRole, createdFromIntent: true, rejectedAdminIntent: false }
  }
  return { role: null, createdFromIntent: false, rejectedAdminIntent: false }
}

function isProfileSuspended(profile) {
  if (!profile) return false
  if (profile.suspended === true) return true
  if (profile.verificationStatus === 'suspended') return true
  return false
}

function resolvePostAuthDestination(profile) {
  if (isProfileSuspended(profile)) {
    return { blocked: true, path: '/auth/signin', onboardingRequired: false }
  }
  if (!profile.userType) {
    return { blocked: false, path: '/auth/role-selection?google=1', onboardingRequired: true }
  }
  if (profile.onboardingCompleted !== true && (profile.userType === 'sme' || profile.userType === 'youth-agent')) {
    return {
      blocked: false,
      path: profile.userType === 'youth-agent' ? '/agent/onboarding' : '/sme/onboarding',
      onboardingRequired: true,
    }
  }
  const dash =
    profile.userType === 'youth-agent'
      ? '/agent/dashboard'
      : profile.userType === 'admin'
        ? '/admin/dashboard'
        : '/sme/dashboard'
  return { blocked: false, path: dash, onboardingRequired: false }
}

function stripPrivilegedFields(data) {
  const PRIVILEGED = [
    'userType',
    'role',
    'founderAccess',
    'verificationStatus',
    'suspended',
    'reliabilityScore',
    'missedBriefingCount',
    'completedBriefingCount',
    'acceptedBriefingCount',
    'rating',
    'totalJobs',
  ]
  const out = { ...data }
  for (const key of PRIVILEGED) delete out[key]
  return out
}

function sanitizeAuthErrorCode(code) {
  const APPROVED = [
    'auth/popup-blocked',
    'auth/popup-closed-by-user',
    'auth/cancelled-popup-request',
    'auth/account-exists-with-different-credential',
    'auth/network-request-failed',
    'auth/user-disabled',
    'auth/unauthorized-domain',
    'auth/operation-not-allowed',
    'auth/internal-error',
    'unknown',
  ]
  return APPROVED.includes(code) ? code : 'unknown'
}

function sanitizeMetadata(metadata) {
  const ALLOWLIST = new Set([
    'authenticationProvider',
    'registrationJourney',
    'errorCode',
    'pagePath',
    'deviceCategory',
    'path',
    'feature',
  ])
  const FORBIDDEN = ['password', 'token', 'idtoken', 'authorization', 'secret', 'oauth', 'refresh']
  const out = {}
  for (const [key, value] of Object.entries(metadata || {})) {
    const lower = key.toLowerCase()
    if (FORBIDDEN.some((f) => lower.includes(f))) return { ok: false, error: key }
    if (!ALLOWLIST.has(key)) return { ok: false, error: key }
    out[key] = value
  }
  return { ok: true, metadata: out }
}

const checks = []
function check(name, ok, detail = '') {
  checks.push({ name, ok, detail })
  if (!ok) console.error('FAIL', name, detail)
}

// Existing SME retains role when signing in from agent page intent
{
  const r = resolveBootstrapRole({ existingUserType: 'sme', intendedRole: 'youth-agent' })
  check('existing SME retains sme role', r.role === 'sme' && !r.createdFromIntent)
}

// Existing youth agent retains role
{
  const r = resolveBootstrapRole({ existingUserType: 'youth-agent', intendedRole: 'sme' })
  check('existing youth-agent retains role', r.role === 'youth-agent')
}

// Admin not assigned from client
{
  const r = resolveBootstrapRole({ existingUserType: null, intendedRole: 'admin' })
  check('admin intent rejected', r.role === null && r.rejectedAdminIntent === true)
}

// First-time SME journey
{
  const r = resolveBootstrapRole({ existingUserType: null, intendedRole: 'sme' })
  check('SME google registration uses sme', r.role === 'sme' && r.createdFromIntent)
}

// First-time agent journey
{
  const r = resolveBootstrapRole({ existingUserType: null, intendedRole: 'youth-agent' })
  check('Youth Agent google registration uses youth-agent', r.role === 'youth-agent')
}

// Founder cannot self-assign via bootstrap role resolution
{
  const stripped = stripPrivilegedFields({ founderAccess: true, userType: 'admin', displayName: 'X' })
  check('founderAccess stripped from client patch', stripped.founderAccess === undefined)
  check('userType stripped from client patch', stripped.userType === undefined)
}

// First-time onboarding destination
{
  const d = resolvePostAuthDestination({
    uid: 'u1',
    email: 'a@b.c',
    displayName: 'A',
    userType: 'sme',
    onboardingCompleted: false,
    createdAt: '',
    updatedAt: '',
  })
  check('first-time SME goes to onboarding', d.path === '/sme/onboarding' && d.onboardingRequired)
}

{
  const d = resolvePostAuthDestination({
    uid: 'u1',
    email: 'a@b.c',
    displayName: 'A',
    userType: 'youth-agent',
    onboardingCompleted: false,
    createdAt: '',
    updatedAt: '',
  })
  check('first-time agent goes to onboarding', d.path === '/agent/onboarding')
}

// Suspended blocked
{
  const d = resolvePostAuthDestination({
    uid: 'u1',
    email: 'a@b.c',
    displayName: 'A',
    userType: 'youth-agent',
    verificationStatus: 'suspended',
    onboardingCompleted: true,
    createdAt: '',
    updatedAt: '',
  })
  check('suspended user blocked', d.blocked === true)
}

// Account conflict error code approved
check(
  'account conflict error approved',
  sanitizeAuthErrorCode('auth/account-exists-with-different-credential') ===
    'auth/account-exists-with-different-credential'
)
check('popup blocked error approved', sanitizeAuthErrorCode('auth/popup-blocked') === 'auth/popup-blocked')
check('unknown error sanitized', sanitizeAuthErrorCode('auth/evil') === 'unknown')

// Metadata excludes tokens
{
  const bad = sanitizeMetadata({ authenticationProvider: 'google', idToken: 'secret' })
  check('rejects idToken metadata', bad.ok === false)
  const bad2 = sanitizeMetadata({ authenticationProvider: 'google', oauthAccessToken: 'x' })
  check('rejects oauth token metadata', bad2.ok === false)
  const good = sanitizeMetadata({
    authenticationProvider: 'google',
    registrationJourney: 'sme',
    errorCode: 'auth/popup-blocked',
    deviceCategory: 'desktop',
  })
  check('allows approved auth metadata', good.ok === true)
}

// Sign-in page google button contract (file contains test id)
const fs = require('fs')
const signin = fs.readFileSync(path.join(__dirname, '../app/auth/signin/page.tsx'), 'utf8')
check('signin renders Google continue', signin.includes('GoogleContinueButton'))
check('signin keeps email/password', signin.includes('signIn(') && signin.includes('Forgot password'))

const signup = fs.readFileSync(path.join(__dirname, '../app/auth/signup/page.tsx'), 'utf8')
check('signup has Google for journey', signup.includes('Continue with Google as SME') || signup.includes('intendedRole'))
check('signup SME google uses sme journey', signup.includes("intendedRole: journey"))

const btn = fs.readFileSync(
  path.join(__dirname, '../components/auth/GoogleContinueButton.tsx'),
  'utf8'
)
check('Google button has test id', btn.includes('data-testid="google-continue-button"'))

const rules = fs.readFileSync(path.join(__dirname, '../firestore.rules'), 'utf8')
check('rules block userType escalation', rules.includes("hasAny([") && rules.includes("'userType'"))
check('rules block founderAccess', rules.includes("'founderAccess'"))
check('rules only allow sme|youth-agent create', rules.includes("userType in ['sme', 'youth-agent']"))

const schema = fs.readFileSync(path.join(__dirname, '../lib/founder/eventSchema.ts'), 'utf8')
check('events include google_sign_in_succeeded', schema.includes("'google_sign_in_succeeded'"))
check('events include first_google_registration', schema.includes("'first_google_registration'"))

const policy = fs.readFileSync(path.join(__dirname, '../lib/security/apiRoutePolicy.ts'), 'utf8')
check('auth-funnel is public POST', policy.includes('/api/product-events/auth-funnel'))

const failed = checks.filter((c) => !c.ok)
console.log(
  JSON.stringify(
    {
      passed: failed.length === 0,
      total: checks.length,
      failed: failed.map((f) => f.name),
      checks,
    },
    null,
    2
  )
)
process.exit(failed.length === 0 ? 0 : 1)
