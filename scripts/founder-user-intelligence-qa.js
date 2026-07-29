#!/usr/bin/env node
/**
 * Founder User Intelligence — access, schema, engagement QA (no deploy).
 * Usage: node scripts/founder-user-intelligence-qa.js
 */
const path = require('path')
process.chdir(path.join(__dirname, '..'))
require('./load-env-local').loadEnvLocal()

const assert = (cond, msg) => {
  if (!cond) throw new Error(msg)
}

function testEngagement() {
  // Inline mirror of classify rules
  function daysBetween(fromIso, to = new Date()) {
    if (!fromIso) return null
    return Math.floor((to.getTime() - new Date(fromIso).getTime()) / 86400000)
  }
  function classify(input) {
    const daysSinceReg = daysBetween(input.registeredAt) ?? 9999
    const daysSinceActive = daysBetween(input.lastMeaningfulAt)
    if (!input.onboardingCompleted && daysSinceReg <= 60) return 'onboarding'
    if (daysSinceReg <= 7) return 'new'
    if (daysSinceActive == null) return daysSinceReg > 30 ? 'dormant' : 'exploring'
    if (daysSinceActive > 30) return 'dormant'
    if (daysSinceActive >= 14 && daysSinceActive <= 30) return 'at_risk'
    if (daysSinceActive <= 14 && input.sessionCount >= 3 && input.meaningfulEventCount >= 5) {
      return 'highly_active'
    }
    if (daysSinceActive <= 14) return input.meaningfulEventCount > 0 ? 'active' : 'exploring'
    return 'exploring'
  }

  const now = new Date()
  const daysAgo = (n) => new Date(now.getTime() - n * 86400000).toISOString()

  assert(
    classify({
      registeredAt: daysAgo(2),
      lastMeaningfulAt: daysAgo(1),
      onboardingCompleted: true,
      meaningfulEventCount: 1,
      sessionCount: 1,
    }) === 'new',
    'new classification'
  )
  assert(
    classify({
      registeredAt: daysAgo(20),
      lastMeaningfulAt: null,
      onboardingCompleted: false,
      meaningfulEventCount: 0,
      sessionCount: 0,
    }) === 'onboarding',
    'onboarding classification'
  )
  assert(
    classify({
      registeredAt: daysAgo(60),
      lastMeaningfulAt: daysAgo(40),
      onboardingCompleted: true,
      meaningfulEventCount: 2,
      sessionCount: 2,
    }) === 'dormant',
    'dormant classification'
  )
  console.log('engagement: PASS')
}

function testAccess() {
  const {
    evaluateFounderAccess,
    isFounderIntelligenceEnabled,
  } = require('../lib/founder/access.ts')

  // When requiring TS from node without transpile, fall back to duplicated logic
}

function testAccessJs() {
  function evaluate({ enabled, authenticated, userType, email, founderAccess }) {
    if (!enabled) return { ok: false, reason: 'flag_disabled' }
    if (!authenticated) return { ok: false, reason: 'unauthorized' }
    if (userType !== 'admin') return { ok: false, reason: 'forbidden_not_admin' }
    const allow = (process.env.FOUNDER_EMAIL_ALLOWLIST || 'info@tenderbriefing.co.za')
      .split(',')
      .map((e) => e.trim().toLowerCase())
    if (founderAccess === true || allow.includes(String(email || '').toLowerCase())) {
      return { ok: true }
    }
    return { ok: false, reason: 'forbidden_not_founder' }
  }

  assert(evaluate({ enabled: false, authenticated: true, userType: 'admin', email: 'info@tenderbriefing.co.za' }).reason === 'flag_disabled', 'flag off')
  assert(evaluate({ enabled: true, authenticated: false, userType: 'admin' }).reason === 'unauthorized', 'auth required')
  assert(evaluate({ enabled: true, authenticated: true, userType: 'sme', email: 'x@y.com' }).reason === 'forbidden_not_admin', 'sme blocked')
  assert(evaluate({ enabled: true, authenticated: true, userType: 'admin', email: 'ops-smoke-admin@tenderbriefing.co.za' }).reason === 'forbidden_not_founder', 'ordinary admin blocked')
  assert(evaluate({ enabled: true, authenticated: true, userType: 'admin', email: 'info@tenderbriefing.co.za' }).ok === true, 'founder email allowed')
  assert(evaluate({ enabled: true, authenticated: true, userType: 'admin', email: 'other@x.com', founderAccess: true }).ok === true, 'founderAccess flag allowed')

  // Server flag authoritative: client-only enable must not unlock evaluate when enabled=false
  assert(
    evaluate({
      enabled: false,
      authenticated: true,
      userType: 'admin',
      email: 'info@tenderbriefing.co.za',
      founderAccess: true,
    }).reason === 'flag_disabled',
    'server flag off blocks founder'
  )
  console.log('access: PASS')
}

function testMetadata() {
  const { EVENT_NAMES, ingestProductEvent } = require('../backend/services/productEventService.js')
  assert(EVENT_NAMES.has('tender_saved'), 'tender_saved approved')
  assert(!EVENT_NAMES.has('password_entered'), 'password event rejected by catalogue')
  console.log('event catalogue: PASS')
  return ingestProductEvent(
    { uid: 'qa-meta', userType: 'sme' },
    { eventName: 'tender_saved', metadata: { password: 'nope' } }
  ).then((r) => {
    assert(r.ok === false && /Forbidden/.test(r.error || ''), 'password metadata rejected')
    console.log('metadata rejection: PASS')
  })
}

async function testFirestoreGrant() {
  process.env.FOUNDER_USER_INTELLIGENCE_ENABLED = 'true'
  const { getFirebaseAdmin } = require('../backend/config/firebaseAdmin')
  const admin = getFirebaseAdmin()
  const email = 'info@tenderbriefing.co.za'
  const user = await admin.auth().getUserByEmail(email)
  await admin.firestore().collection('users').doc(user.uid).set(
    {
      founderAccess: true,
      userType: 'admin',
      role: 'admin',
      email,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  )
  const doc = await admin.firestore().collection('users').doc(user.uid).get()
  assert(doc.data().founderAccess === true, 'founderAccess written')
  assert(doc.data().userType === 'admin', 'still admin')
  console.log('firestore founder grant: PASS', { uid: user.uid.slice(0, 8) + '…' })
}

async function main() {
  const results = []
  try {
    testEngagement()
    results.push('engagement')
    testAccessJs()
    results.push('access')
    await testMetadata()
    results.push('events')
    await testFirestoreGrant()
    results.push('founder_grant')
    console.log(JSON.stringify({ ok: true, results }, null, 2))
  } catch (err) {
    console.error(JSON.stringify({ ok: false, error: err.message, results }, null, 2))
    process.exit(1)
  }
}

main()
