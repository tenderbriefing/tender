const { getFirestore } = require('../config/firebaseAdmin')

// Allow-listed first-party product events (keep in sync with lib/founder/eventSchema.ts)
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
])

const METADATA_ALLOWLIST = new Set([
  'tenderId',
  'tenderNumber',
  'requestId',
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
])

const FORBIDDEN = ['password', 'token', 'idtoken', 'authorization', 'secret', 'bank', 'card', 'cvv', 'idnumber', 'said', 'rawtext', 'formvalue', 'keystroke']

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
  'assigned_sme_opened',
  'sme_contacted',
  'follow_up_completed',
  'tender_shared_with_sme',
  'briefing_accepted',
  'briefing_report_submitted',
  'profile_updated',
  'training_completed',
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

async function ingestProductEvent(actor, input) {
  if (!EVENT_NAMES.has(input.eventName)) {
    return { ok: false, error: `Unknown event: ${input.eventName}` }
  }
  const meta = cleanMetadata(input.metadata)
  if (!meta.ok) return meta

  const db = getFirestore()
  const now = new Date().toISOString()
  const day = now.slice(0, 10)
  const doc = {
    eventId: `pe_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    eventName: input.eventName,
    actorUserId: actor.uid,
    actorRole: actor.userType,
    targetUserId: input.targetUserId || null,
    targetEntityType: input.targetEntityType || null,
    targetEntityId: input.targetEntityId || null,
    sessionId: input.sessionId || null,
    pagePath: input.pagePath || null,
    feature: input.feature || null,
    timestamp: now,
    day,
    province: input.province || actor.province || null,
    municipality: null,
    deviceCategory: input.deviceCategory || null,
    referralSource: input.referralSource || null,
    meaningful: MEANINGFUL.has(input.eventName),
    metadata: meta.metadata,
  }

  await db.collection('productEvents').doc(doc.eventId).set(doc)

  // Lightweight user activity rollup (bounded write)
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
        lastSeenAt: now,
        lastLoginAt: doc.eventName === 'user_logged_in' || doc.eventName === 'google_sign_in_succeeded' ? now : prev.lastLoginAt || null,
        authenticationProvider:
          (meta.metadata && meta.metadata.authenticationProvider) || prev.authenticationProvider || null,
        firstSeenAt: prev.firstSeenAt || now,
        registrationDate: prev.registrationDate || prev.firstSeenAt || now,
        lastMeaningfulAt: doc.meaningful ? now : prev.lastMeaningfulAt || null,
        meaningfulEventCount: meaningfulCount,
        eventCount: Number(prev.eventCount || 0) + 1,
        sessionCount: Math.max(Number(prev.sessionCount || 0), sessionIds.size),
        recentSessionIds: Array.from(sessionIds),
        lastEventName: doc.eventName,
        lastPagePath: doc.pagePath,
        updatedAt: now,
      },
      { merge: true }
    )
  })

  return { ok: true, data: { eventId: doc.eventId } }
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
  listEventsForUser,
  EVENT_NAMES,
  MEANINGFUL,
}
