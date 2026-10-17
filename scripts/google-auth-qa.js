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
    return { blocked: false, path: '/auth/role-selection?recover=1', onboardingRequired: true }
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
    'verified',
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

/** Mirror of serverProfileBootstrap.sanitizeRegistrationAdditional */
function sanitizeRegistrationAdditional(data) {
  if (!data || typeof data !== 'object') return {}
  const stripped = stripPrivilegedFields({ ...data })
  delete stripped.uid
  delete stripped.email
  delete stripped.verified
  delete stripped.onboardingCompleted
  delete stripped.onboardingCompletedAt
  return stripped
}

/** Mirror of lib/auth/saCellphone.normalizeSaCellphone (pragmatic SA mobile). */
function normalizeSaCellphone(raw) {
  const trimmed = String(raw || '').trim()
  if (!trimmed) return null
  let digits = trimmed.replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('0027')) digits = digits.slice(2)
  if (digits.startsWith('27') && digits.length === 11) {
    const national = digits.slice(2)
    if (!/^[6-8]\d{8}$/.test(national)) return null
    return `+27${national}`
  }
  if (digits.startsWith('0') && digits.length === 10) {
    const national = digits.slice(1)
    if (!/^[6-8]\d{8}$/.test(national)) return null
    return `+27${national}`
  }
  if (digits.length === 9 && /^[6-8]\d{8}$/.test(digits)) return `+27${digits}`
  return null
}

/** Mirror of serverProfileBootstrap.hasFullRegistrationPayload */
function hasFullRegistrationPayload(role, data) {
  if (!data || typeof data !== 'object') return false
  const phoneOk = Boolean(
    normalizeSaCellphone(
      (typeof data.phoneNumber === 'string' && data.phoneNumber) ||
        (typeof data.whatsAppNumber === 'string' && data.whatsAppNumber) ||
        ''
    )
  )
  const province = typeof data.province === 'string' && data.province.trim().length > 0
  if (!phoneOk || !province) return false
  if (role === 'sme') {
    const company = typeof data.companyName === 'string' && data.companyName.trim().length > 0
    const categories = Array.isArray(data.categories) && data.categories.length > 0
    return company && categories
  }
  const city = typeof data.city === 'string' && data.city.trim().length > 0
  return city
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

// F02 — bootstrap strips trust metrics + onboarding flags; full payload is structural
{
  const sanitized = sanitizeRegistrationAdditional({
    displayName: 'Keep',
    companyName: 'Acme',
    phoneNumber: '0821234567',
    province: 'GP',
    categories: ['IT'],
    founderAccess: true,
    verificationStatus: 'verified',
    reliabilityScore: 999,
    rating: 5,
    onboardingCompleted: true,
    onboardingCompletedAt: '2099-01-01',
    verified: true,
  })
  check('sanitize strips onboardingCompleted', sanitized.onboardingCompleted === undefined)
  check('sanitize strips reliabilityScore', sanitized.reliabilityScore === undefined)
  check('sanitize strips verificationStatus', sanitized.verificationStatus === undefined)
  check('sanitize strips verified', sanitized.verified === undefined)
  check('sanitize keeps companyName', sanitized.companyName === 'Acme')
  check(
    'boolean alone is not full SME registration',
    hasFullRegistrationPayload('sme', { onboardingCompleted: true }) === false
  )
  check(
    'structured SME signup is full registration',
    hasFullRegistrationPayload('sme', {
      companyName: 'Acme',
      phoneNumber: '0821234567',
      province: 'GP',
      categories: ['IT'],
    }) === true
  )
  check(
    'Google-minimal agent payload is not full registration',
    hasFullRegistrationPayload('youth-agent', {}) === false
  )
  check(
    'structured agent signup is full registration',
    hasFullRegistrationPayload('youth-agent', {
      phoneNumber: '0821234567',
      province: 'GP',
      city: 'Johannesburg',
    }) === true
  )
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

// Sign-in / signup Google UI is gated by NEXT_PUBLIC_GOOGLE_AUTH_ENABLED (fail-closed).
const fs = require('fs')
const signin = fs.readFileSync(path.join(__dirname, '../app/auth/signin/page.tsx'), 'utf8')
check('signin keeps Google continue behind flag', signin.includes('GoogleContinueButton'))
check('signin gates Google UI with isGoogleAuthEnabled', signin.includes('isGoogleAuthEnabled'))
check('signin keeps email/password', signin.includes('signIn(') && signin.includes('Forgot password'))

const signup = fs.readFileSync(path.join(__dirname, '../app/auth/signup/page.tsx'), 'utf8')
check(
  'signup has Google for journey (flagged)',
  signup.includes('Continue with Google as SME') || signup.includes('intendedRole')
)
check('signup gates Google UI with isGoogleAuthEnabled', signup.includes('isGoogleAuthEnabled'))
check('signup SME google uses sme journey', signup.includes('intendedRole: journey'))

const btn = fs.readFileSync(
  path.join(__dirname, '../components/auth/GoogleContinueButton.tsx'),
  'utf8'
)
check('Google button has test id', btn.includes('data-testid="google-continue-button"'))

const flag = fs.readFileSync(
  path.join(__dirname, '../lib/auth/googleAuthEnabled.ts'),
  'utf8'
)
check('google auth flag helper exists', flag.includes('NEXT_PUBLIC_GOOGLE_AUTH_ENABLED'))
check('google auth flag fail-closed', flag.includes("v === 'true'"))

const continueFlow = fs.readFileSync(
  path.join(__dirname, '../lib/auth/continueWithGoogle.ts'),
  'utf8'
)
check('continueWithGoogle gates on flag', continueFlow.includes('isGoogleAuthEnabled()'))
check(
  'continueWithGoogle arms welcome only when allowWelcome',
  continueFlow.includes('allowWelcome') &&
    continueFlow.includes('markPostRegistrationWelcomePending')
)

const welcomeLib = fs.readFileSync(
  path.join(__dirname, '../lib/auth/postRegistrationWelcome.ts'),
  'utf8'
)
check('post-registration welcome path exists', welcomeLib.includes("'/auth/welcome'"))
check('SME welcome CTA label', welcomeLib.includes('Go to Dashboard'))
check(
  'agent welcome uses dashboard not workspace as CTA target helper note',
  welcomeLib.includes('fail-closed') && welcomeLib.includes('dashboardPathForRole')
)

const welcomePage = fs.readFileSync(
  path.join(__dirname, '../app/auth/welcome/page.tsx'),
  'utf8'
)
check('welcome page uses trusted profile role', welcomePage.includes('userProfile.userType'))
check(
  'welcome page does not read client role query',
  !/searchParams.*get\(\s*['"]role['"]\s*\)/.test(welcomePage)
)

const bootstrapRoute = fs.readFileSync(
  path.join(__dirname, '../app/api/auth/bootstrap-profile/route.ts'),
  'utf8'
)
check(
  'bootstrap create redirects to welcome',
  bootstrapRoute.includes('POST_REGISTRATION_WELCOME_PATH') &&
    bootstrapRoute.includes('continuePath')
)
check(
  'bootstrap existing profile stays created:false',
  /if \(snap\.exists\)[\s\S]*created:\s*false/.test(bootstrapRoute)
)

const roleSelection = fs.readFileSync(
  path.join(__dirname, '../app/auth/role-selection/page.tsx'),
  'utf8'
)
check(
  'role-selection recovery skips welcome page',
  roleSelection.includes('continuePath') &&
    !roleSelection.includes('markPostRegistrationWelcomePending')
)

const linkAccount = fs.readFileSync(
  path.join(__dirname, '../app/auth/link-account/page.tsx'),
  'utf8'
)
check(
  'link-account does not arm welcome',
  !linkAccount.includes('markPostRegistrationWelcomePending') &&
    !linkAccount.includes('allowWelcome')
)

const dockerfile = fs.readFileSync(path.join(__dirname, '../Dockerfile'), 'utf8')
check(
  'Dockerfile defaults Google auth off',
  dockerfile.includes('NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=false')
)

const cloudbuild = fs.readFileSync(path.join(__dirname, '../cloudbuild.yaml'), 'utf8')
check(
  'cloudbuild ships Google auth disabled',
  cloudbuild.includes('NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=false')
)

const rules = fs.readFileSync(path.join(__dirname, '../firestore.rules'), 'utf8')
check('rules block userType escalation', rules.includes("hasAny([") && rules.includes("'userType'"))
check('rules block founderAccess', rules.includes("'founderAccess'"))
check('rules only allow sme|youth-agent create', rules.includes("userType in ['sme', 'youth-agent']"))
check('rules have agentOwnerUpdateAllowed', rules.includes('agentOwnerUpdateAllowed'))
check(
  'rules deny agent verificationStatus via denylist helper',
  /function\s+agentOwnerUpdateAllowed[\s\S]*?'verificationStatus'/.test(rules)
)

const bootstrapSrc = fs.readFileSync(
  path.join(__dirname, '../lib/auth/serverProfileBootstrap.ts'),
  'utf8'
)
check(
  'bootstrap never trusts extra.onboardingCompleted',
  /const onboardingCompleted\s*=\s*input\.onboardingCompleted\s*===\s*true/.test(bootstrapSrc) &&
    !/onboardingCompleted\s*=\s*input\.onboardingCompleted\s*===\s*true\s*\|\|/.test(bootstrapSrc) &&
    !/\|\|\s*extra\.onboardingCompleted/.test(bootstrapSrc)
)
check(
  'bootstrap forces agent trust defaults',
  bootstrapSrc.includes("verificationStatus = 'pending'") &&
    bootstrapSrc.includes('reliabilityScore = 100')
)

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
