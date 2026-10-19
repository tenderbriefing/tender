/**
 * Phase 18 — SME Connect data/event boundary (prepare only).
 *
 * Future flow (NOT implemented here — no customer messages in Phase 18):
 *   new compulsory briefing ingested
 *   → match against SME prior paid tenders/RFQs
 *   → relevance score
 *   → recommendation + payment link
 *
 * This module only emits an auditable internal event / optional Firestore
 * marker so Phase 19+ can subscribe without changing PayFast/dispatch.
 */
const auditLogService = require('./auditLogService')

const SME_CONNECT_EVENT = 'sme_connect.briefing_ingested'

/**
 * Emit boundary event after a day replay persists tenders.
 * Never sends email. Never creates payment links.
 */
async function emitSmeConnectBriefingIngested(payload = {}) {
  const event = {
    type: SME_CONNECT_EVENT,
    schemaVersion: 1,
    at: new Date().toISOString(),
    day: payload.day || null,
    sourceCount: payload.sourceCount ?? null,
    persistedCount: payload.persistedCount ?? null,
    // Placeholders for Phase 19 matching — intentionally null
    matchedSmeCount: null,
    recommendationsQueued: false,
    customerNotified: false,
  }

  await auditLogService.logEvent({
    type: SME_CONNECT_EVENT,
    entityId: payload.day || 'unknown-day',
    ...event,
  })

  // Optional durable marker for future workers (JSON/Firestore sync state)
  try {
    const { getStorage } = require('./storageAdapter')
    const storage = getStorage()
    if (typeof storage.getSyncState === 'function' && typeof storage.saveSyncState === 'function') {
      const state = await storage.getSyncState()
      const queue = Array.isArray(state.smeConnectEventQueue) ? state.smeConnectEventQueue : []
      queue.unshift(event)
      state.smeConnectEventQueue = queue.slice(0, 100)
      await storage.saveSyncState(state)
    }
  } catch {
    /* non-fatal */
  }

  return event
}

module.exports = {
  SME_CONNECT_EVENT,
  emitSmeConnectBriefingIngested,
}
