/**
 * Phase 18/19 — SME Connect data/event boundary.
 *
 * Phase 19: may enqueue matching; NEVER sends customer email or payment links.
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
    schemaVersion: 2,
    at: new Date().toISOString(),
    day: payload.day || null,
    sourceCount: payload.sourceCount ?? null,
    persistedCount: payload.persistedCount ?? null,
    matchedSmeCount: null,
    recommendationsQueued: false,
    customerNotified: false,
  }

  // Phase 19: optionally run matching for compulsory-classified tenders in payload
  if (payload.runMatching === true && Array.isArray(payload.tenders) && payload.tenders.length) {
    try {
      const matching = require('./smeConnectMatchingService')
      let candidateCount = 0
      for (const tender of payload.tenders.slice(0, 20)) {
        if (
          tender.briefingClassification === 'CONFIRMED_COMPULSORY' ||
          tender.briefingClassification === 'LIKELY_COMPULSORY'
        ) {
          const out = await matching.matchTenderToPaidSmes(tender)
          candidateCount += out.candidates?.length || 0
        }
      }
      event.matchedSmeCount = candidateCount
      event.recommendationsQueued = candidateCount > 0
      event.customerNotified = false
    } catch {
      /* matching non-fatal */
    }
  }

  await auditLogService.logEvent({
    type: SME_CONNECT_EVENT,
    entityId: payload.day || 'unknown-day',
    ...event,
  })

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
