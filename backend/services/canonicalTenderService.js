/**
 * Phase 19 — Canonical tender provenance merge.
 * Never overwrites a stronger source silently. Website never labeled as OCDS.
 */
const {
  SOURCE_TYPE,
  SOURCE_CONFIDENCE,
  EXCEPTION_CATEGORY,
  SOURCE_FIDELITY_FIELDS,
  normalizeCompareValue,
} = require('../domain/ocdsDayReconciliation')
const { raiseException } = require('./parityExceptionService')
const { getStorage } = require('./storageAdapter')

const CONFIDENCE_RANK = {
  [SOURCE_CONFIDENCE.AUTHORITATIVE_STRUCTURED]: 2,
  [SOURCE_CONFIDENCE.OFFICIAL_PUBLIC]: 1,
}

function confidenceForSourceType(sourceType) {
  if (
    sourceType === SOURCE_TYPE.OCDS_RELEASE_API ||
    sourceType === SOURCE_TYPE.OCDS_BULK_TRANSPARENCY ||
    sourceType === 'OCDS'
  ) {
    return SOURCE_CONFIDENCE.AUTHORITATIVE_STRUCTURED
  }
  if (sourceType === SOURCE_TYPE.ETENDERS_WEBSITE) {
    return SOURCE_CONFIDENCE.OFFICIAL_PUBLIC
  }
  return SOURCE_CONFIDENCE.OFFICIAL_PUBLIC
}

function normalizeSourceEntry(entry) {
  const type = entry.type || entry.sourceType || SOURCE_TYPE.UNRESOLVED
  return {
    type: type === 'OCDS' ? SOURCE_TYPE.OCDS_RELEASE_API : type,
    sourceId: entry.sourceId || entry.ocid || entry.tenderNumber || null,
    sourceUrl: entry.sourceUrl || entry.sourceIdentifier || null,
    retrievedAt: entry.retrievedAt || new Date().toISOString(),
    confidence: entry.confidence || confidenceForSourceType(type),
  }
}

function ensureSources(tender) {
  const sources = Array.isArray(tender.sources) ? tender.sources.map(normalizeSourceEntry) : []
  if (!sources.length && tender.ingestSourceType) {
    sources.push(
      normalizeSourceEntry({
        type: tender.ingestSourceType,
        sourceId: tender.ocid || tender.tenderNumber,
        retrievedAt: tender.sourceRetrievedAt,
      })
    )
  }
  // Phase 18 may have set ingest-like values on sourceType — do not confuse with sector
  if (
    !sources.length &&
    (tender.sourceType === SOURCE_TYPE.OCDS_RELEASE_API ||
      tender.sourceType === SOURCE_TYPE.OCDS_BULK_TRANSPARENCY)
  ) {
    sources.push(
      normalizeSourceEntry({
        type: tender.sourceType,
        sourceId: tender.ocid || tender.tenderNumber,
        retrievedAt: tender.sourceRetrievedAt || tender.lastSyncedAt,
      })
    )
  }
  return sources
}

function strongerConfidence(a, b) {
  return (CONFIDENCE_RANK[a] || 0) >= (CONFIDENCE_RANK[b] || 0) ? a : b
}

/**
 * Merge incoming fields into canonical tender with provenance.
 * @returns {{ tender, conflictsOpened: number }}
 */
async function mergeIntoCanonical(existing, incoming, sourceMeta) {
  const sourceEntry = normalizeSourceEntry(sourceMeta)
  const tender = { ...(existing || {}) }
  const sources = ensureSources(tender)
  const already = sources.find(
    (s) =>
      s.type === sourceEntry.type &&
      (s.sourceId === sourceEntry.sourceId || s.sourceUrl === sourceEntry.sourceUrl)
  )
  if (!already) sources.push(sourceEntry)
  else Object.assign(already, sourceEntry)

  tender.sources = sources
  tender.ingestSourceType = tender.ingestSourceType || sourceEntry.type
  tender.fieldProvenance = { ...(tender.fieldProvenance || {}) }
  tender.sourceConflicts = Array.isArray(tender.sourceConflicts) ? [...tender.sourceConflicts] : []

  let conflictsOpened = 0
  const fields = SOURCE_FIDELITY_FIELDS.filter((f) => incoming[f] != null && incoming[f] !== '')

  for (const field of fields) {
    const incomingVal = incoming[field]
    const currentVal = tender[field]
    const currentProv = tender.fieldProvenance[field]
    const currentConf = currentProv?.confidence || null

    if (currentVal == null || currentVal === '' || !currentProv) {
      tender[field] = incomingVal
      tender.fieldProvenance[field] = {
        sourceType: sourceEntry.type,
        retrievedAt: sourceEntry.retrievedAt,
        confidence: sourceEntry.confidence,
      }
      continue
    }

    if (normalizeCompareValue(currentVal) === normalizeCompareValue(incomingVal)) {
      // Same value — keep stronger provenance
      if (
        !currentConf ||
        strongerConfidence(sourceEntry.confidence, currentConf) === sourceEntry.confidence
      ) {
        tender.fieldProvenance[field] = {
          sourceType: sourceEntry.type,
          retrievedAt: sourceEntry.retrievedAt,
          confidence: sourceEntry.confidence,
        }
      }
      continue
    }

    // Conflict
    const incomingStronger =
      (CONFIDENCE_RANK[sourceEntry.confidence] || 0) > (CONFIDENCE_RANK[currentConf] || 0)
    if (incomingStronger) {
      tender[field] = incomingVal
      tender.fieldProvenance[field] = {
        sourceType: sourceEntry.type,
        retrievedAt: sourceEntry.retrievedAt,
        confidence: sourceEntry.confidence,
      }
    }

    const conflict = {
      field,
      values: [
        { sourceType: currentProv?.sourceType || 'EXISTING', value: currentVal },
        { sourceType: sourceEntry.type, value: incomingVal },
      ],
      status: 'OPEN',
      at: new Date().toISOString(),
    }
    tender.sourceConflicts.push(conflict)
    conflictsOpened += 1
    await raiseException({
      category: EXCEPTION_CATEGORY.SOURCE_CONFLICT,
      tenderNumber: tender.tenderNumber || incoming.tenderNumber,
      ocid: tender.ocid || incoming.ocid,
      title: tender.title || incoming.title,
      detail: `Field conflict on ${field}`,
      payload: conflict,
    })
  }

  // Copy non-fidelity fields only when missing
  for (const [k, v] of Object.entries(incoming)) {
    if (SOURCE_FIDELITY_FIELDS.includes(k)) continue
    if (['sources', 'fieldProvenance', 'sourceConflicts'].includes(k)) continue
    if (tender[k] == null && v != null) tender[k] = v
  }

  return { tender, conflictsOpened }
}

async function applyCanonicalProvenanceToMirror({ limit = 500 } = {}) {
  const storage = getStorage()
  const all = await storage.getTenderBriefings({ limit: Math.min(limit, 5000) })
  const updates = []
  let conflicts = 0
  for (const t of all || []) {
    const sources = ensureSources(t)
    if (!sources.length && !t.fieldProvenance) {
      const { tender, conflictsOpened } = await mergeIntoCanonical(
        t,
        t,
        {
          type: t.ingestSourceType || SOURCE_TYPE.OCDS_RELEASE_API,
          sourceId: t.ocid || t.tenderNumber,
          retrievedAt: t.sourceRetrievedAt || t.lastSyncedAt,
          confidence: SOURCE_CONFIDENCE.AUTHORITATIVE_STRUCTURED,
        }
      )
      conflicts += conflictsOpened
      updates.push(tender)
    } else if (!t.sources || !t.sources.length) {
      updates.push({ ...t, sources, ingestSourceType: t.ingestSourceType || sources[0]?.type })
    }
  }
  if (updates.length) {
    await storage.upsertTenders(updates)
  }
  return { scanned: (all || []).length, updated: updates.length, conflictsOpened: conflicts }
}

module.exports = {
  CONFIDENCE_RANK,
  confidenceForSourceType,
  normalizeSourceEntry,
  ensureSources,
  mergeIntoCanonical,
  applyCanonicalProvenanceToMirror,
}
