/**
 * Phase 18 — Backfill source fidelity fields on historical mirror rows.
 * Does not overwrite derivedBriefingStatus / briefingCompulsory incorrectly.
 */
const { getStorage } = require('./storageAdapter')
const {
  deriveBriefingStatus,
  catalogueCompulsoryFromDerived,
  DERIVED_BRIEFING_STATUS,
} = require('./tenderModel')
const { SOURCE_TYPE } = require('../domain/ocdsDayReconciliation')
const auditLogService = require('./auditLogService')

function needsSourceBackfill(tender) {
  if (!tender) return false
  if (tender.sourceBriefingCompulsory === undefined) return true
  if (!tender.sourceType) return true
  if (!tender.rawSourceHash && tender.ocid) return true
  if (!tender.derivedBriefingStatus) return true
  return false
}

/**
 * Infer sourceBriefingCompulsory from legacy rows without inventing true.
 * - If derived/catalogue already confirmed and raw snapshot exists, prefer snapshot
 * - Else leave null (unknown) rather than false-from-!! coercion
 */
function inferSourceCompulsory(tender) {
  if (tender.sourceBriefingCompulsory === true || tender.sourceBriefingCompulsory === false) {
    return tender.sourceBriefingCompulsory
  }
  const snap = tender.rawSourceSnapshot?.briefingSession
  if (snap && typeof snap === 'object' && 'compulsory' in snap) {
    if (snap.compulsory === true) return true
    if (snap.compulsory === false) return false
  }
  return null
}

async function backfillHistoricalSourceFields(opts = {}) {
  const limit = Math.min(Math.max(1, Number(opts.limit) || 500), 2000)
  const storage = getStorage()
  const all = await storage.getTenderBriefings({ limit: opts.scanLimit || 8000 })
  const candidates = (all || []).filter(needsSourceBackfill).slice(0, limit)

  const updates = []
  for (const tender of candidates) {
    const sourceBriefingCompulsory = inferSourceCompulsory(tender)
    const derivedBriefingStatus =
      tender.derivedBriefingStatus ||
      deriveBriefingStatus(sourceBriefingCompulsory, {
        briefingCompulsory: tender.briefingCompulsory === true,
        briefingVenue: tender.briefingVenue,
        briefingDate: tender.briefingDate,
        matchedBriefingTerms: tender.matchedBriefingTerms,
      })

    // Preserve existing catalogue flag if already set; otherwise derive
    const briefingCompulsory =
      tender.briefingCompulsory === true
        ? true
        : catalogueCompulsoryFromDerived(derivedBriefingStatus)

    updates.push({
      ...tender,
      sourceBriefingCompulsory,
      derivedBriefingStatus,
      briefingCompulsory,
      sourceType: tender.sourceType || SOURCE_TYPE.OCDS_RELEASE_API,
      sourceRetrievedAt: tender.sourceRetrievedAt || tender.lastSyncedAt || null,
      // Do not invent rawSourceHash/snapshot when unavailable
      rawSourceHash: tender.rawSourceHash || null,
      rawSourceSnapshot: tender.rawSourceSnapshot || null,
      historicalSourceBackfilledAt: new Date().toISOString(),
    })
  }

  let written = 0
  if (updates.length) {
    const result = await storage.upsertTenders(updates)
    written = result?.written ?? updates.length
  }

  await auditLogService.logEvent({
    type: 'ocds_historical_source_backfill',
    scanned: (all || []).length,
    candidates: candidates.length,
    written,
  })

  return {
    scanned: (all || []).length,
    candidates: candidates.length,
    written,
    sampleIds: updates.slice(0, 10).map((t) => t.id),
  }
}

module.exports = {
  needsSourceBackfill,
  inferSourceCompulsory,
  backfillHistoricalSourceFields,
  DERIVED_BRIEFING_STATUS,
}
