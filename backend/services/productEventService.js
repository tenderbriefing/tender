/**
 * First-party product events — allow-listed catalogue (sync with lib/founder/eventSchema.ts).
 */
const { getFirestore } = require('../config/firebaseAdmin')
const { formatSastYmd } = require('../utils/sastDay')

const FUNNEL_INSTRUMENTATION_VERSION = '2026-10-p1-funnel-v1'

const EVENT_NAMES = new Set([
  'user_logged_in',
  'google_sign_in_started',
  'google_sign_in_succeeded',
  'google_sign_in_failed',
  'first_google_registration',
  'onboarding_started',
  'onboarding_completed',
  'dashboard_viewed',
  'navigation_selected',
  'search_initiated',
  'filter_applied',
  'notification_opened',
  'help_opened',
  'feedback_submitted',
  'session_started',
  'session_ended',
  'page_viewed',
  'tender_listing_viewed',
  'tender_opened',
  'tender_brief_opened',
  'tender_saved',
  'tender_unsaved',
  'tender_document_downloaded',
  'search_performed',
  'search_no_results',
  'profile_updated',
  'assistance_requested',
  'youth_agent_contacted',
  'booking_intent',
  'booking_created',
  'checkout_started',
  'payment_confirmed',
  'booking_confirmed',
  'assigned_sme_opened',
  'sme_contacted',
  'contact_attempt_recorded',
  'follow_up_scheduled',
  'follow_up_completed',
  'assistance_activity_recorded',
  'tender_shared_with_sme',
  'sme_onboarding_supported',
  'issue_escalated',
  'portfolio_filtered',
  'training_resource_opened',
  'training_completed',
  'briefing_accepted',
  'briefing_declined',
  'briefing_report_submitted',
  'private_tender_submitted',
  'private_tender_approved',
  'private_tender_published',
  'private_tender_viewed',
  'private_tender_briefing_booked',
  'private_tender_rejected',
  'private_tender_changes_requested',
])

const METADATA_ALLOWLIST = new Set([
  'tenderId',
  'tenderNumber',
  'requestId',
  'submissionId',
  'privateTenderId',
  'queryLength',
  'resultCount',
  'province',
  'sector',
  'filterKey',
  'filterValue',
  'path',
  'feature',
  'navItem',
  'deviceCategory',
  'referralSource',
  'durationMs',
  'hasResults',
  'authenticationProvider',
  'registrationJourney',
  'errorCode',
  'pagePath',
  'instrumentationVersion',
  'checkoutId',
])

const FORBIDDEN = [
  'password',
  'token',
  'idtoken',
  'authorization',
  'secret',
  'bank',
  'card',
  'cvv',
  'idnumber',
  'said',
  'rawtext',
  'formvalue',
  'keystroke',
]

const MEANINGFUL = new Set([
  'user_logged_in',
  'google_sign_in_succeeded',
  'first_google_registration',
  'onboarding_completed',
  'search_initiated',
  'search_performed',
  'tender_opened',
  'tender_brief_opened',
  'tender_saved',
  'tender_document_downloaded',
  'assistance_requested',
  'youth_agent_contacted',
  'booking_intent',
  'booking_created',
  'checkout_started',
  'payment_confirmed',
  'booking_confirmed',
  'assigned_sme_opened',
  'sme_contacted',
  'follow_up_completed',
  'tender_shared_with_sme',
  'briefing_accepted',
  'briefing_report_submitted',
  'profile_updated',
  'training_completed',
])

const FUNNEL_EVENTS = new Set([
  'tender_listing_viewed',
  'tender_opened',
  'search_performed',
  'search_no_results',
  'booking_intent',
  'booking_created',
  'checkout_started',
  'payment_confirmed',
  'booking_confirmed',
  'private_tender_briefing_booked',
])

function cleanMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') return { ok: true, metadata: {} }
  const out = {}
  for (const [key, value] of Object.entries(metadata)) {
    const lower = key.toLowerCase()
    if (FORBIDDEN.some((f) => lower.includes(f))) {
      return { ok: false, error: `Forbidden metadata field: ${key}` }
    }
    if (!METADATA_ALLOWLIST.has(key)) {
      return { ok: false, error: `Unapproved metadata field: ${key}` }
    }
    if (typeof value === 'string' && value.length > 200) {
      return { ok: false, error: `Metadata value too long: ${key}` }
    }
    out[key] = value
  }
  return { ok: true, metadata: out }
}

/**
 * @param {{ uid: string, userType?: string, province?: string }} actor
 * @param {object} input
 */
async function ingestProductEvent(actor, input) {
  if (!actor || !actor.uid) {
    return { ok: false, error: 'Actor required' }
  }
  if (!input || typeof input !== 'object' || !input.eventName) {
    return { ok: false, error: 'eventName required' }
  }
  if (!EVENT_NAMES.has(input.eventName)) {
    return { ok: false, error: `Unknown event: ${input.eventName}` }
  }
  const meta = cleanMetadata(input.metadata)
  if (!meta.ok) return meta

  if (FUNNEL_EVENTS.has(input.eventName) && meta.metadata.instrumentationVersion == null) {
    meta.metadata.instrumentationVersion = FUNNEL_INSTRUMENTATION_VERSION
  }

  const db = getFirestore()
  const now = new Date()
  const nowIso = now.toISOString()
  const day = formatSastYmd(now)
  const doc = {
    eventId: `pe_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    eventName: input.eventName,
    actorUserId: actor.uid,
    actorRole: actor.userType || null,
    targetUserId: input.targetUserId || null,
    targetEntityType: input.targetEntityType || null,
    targetEntityId: input.targetEntityId || null,
    sessionId: input.sessionId || null,
    pagePath: input.pagePath || null,
    feature: input.feature || null,
    timestamp: nowIso,
    day,
    province: input.province || actor.province || null,
    municipality: null,
    deviceCategory: input.deviceCategory || null,
    referralSource: input.referralSource || null,
    meaningful: MEANINGFUL.has(input.eventName),
    instrumentationVersion: FUNNEL_EVENTS.has(input.eventName)
      ? FUNNEL_INSTRUMENTATION_VERSION
      : null,
    metadata: meta.metadata,
  }

  await db.collection('productEvents').doc(doc.eventId).set(doc)

  // Lightweight user activity rollup (bounded write) — skip anonymous actors
  if (!String(actor.uid).startsWith('anonymous_')) {
    const summaryRef = db.collection('userActivitySummaries').doc(actor.uid)
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(summaryRef)
      const prev = snap.exists ? snap.data() : {}
      const meaningfulCount = Number(prev.meaningfulEventCount || 0) + (doc.meaningful ? 1 : 0)
      const sessionIds = new Set(prev.recentSessionIds || [])
      if (doc.sessionId) {
        sessionIds.add(doc.sessionId)
        while (sessionIds.size > 20) {
          const first = sessionIds.values().next().value
          sessionIds.delete(first)
        }
      }
      tx.set(
        summaryRef,
        {
          uid: actor.uid,
          actorRole: actor.userType,
          lastSeenAt: nowIso,
          lastLoginAt:
            doc.eventName === 'user_logged_in' || doc.eventName === 'google_sign_in_succeeded'
              ? nowIso
              : prev.lastLoginAt || null,
          authenticationProvider:
            (meta.metadata && meta.metadata.authenticationProvider) ||
            prev.authenticationProvider ||
            null,
          firstSeenAt: prev.firstSeenAt || nowIso,
          registrationDate: prev.registrationDate || prev.firstSeenAt || nowIso,
          lastMeaningfulAt: doc.meaningful ? nowIso : prev.lastMeaningfulAt || null,
          meaningfulEventCount: meaningfulCount,
          eventCount: Number(prev.eventCount || 0) + 1,
          sessionCount: Math.max(Number(prev.sessionCount || 0), sessionIds.size),
          recentSessionIds: Array.from(sessionIds),
          lastEventName: doc.eventName,
          lastPagePath: doc.pagePath,
          updatedAt: nowIso,
        },
        { merge: true }
      )
    })
  }

  return { ok: true, data: { eventId: doc.eventId } }
}

/**
 * Fail-soft commercial funnel helper for trusted server paths.
 * Never throws to callers — checkout/payment must not depend on analytics.
 */
async function emitFunnelEventSafe(actor, input) {
  try {
    return await ingestProductEvent(actor, input)
  } catch (err) {
    console.error(
      '[productEvents] funnel emit failed:',
      err instanceof Error ? err.message.slice(0, 160) : 'unknown'
    )
    return { ok: false, error: 'emit_failed' }
  }
}

async function listEventsForUser(uid, { limit = 50 } = {}) {
  const db = getFirestore()
  const capped = Math.min(Math.max(limit, 1), 100)
  const snap = await db
    .collection('productEvents')
    .where('actorUserId', '==', uid)
    .orderBy('timestamp', 'desc')
    .limit(capped)
    .get()
  return snap.docs.map((d) => d.data())
}

module.exports = {
  ingestProductEvent,
  emitFunnelEventSafe,
  listEventsForUser,
  EVENT_NAMES,
  MEANINGFUL,
  METADATA_ALLOWLIST,
  FUNNEL_INSTRUMENTATION_VERSION,
}
