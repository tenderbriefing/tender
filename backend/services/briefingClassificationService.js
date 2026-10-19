/**
 * Phase 19 — Evidence-based compulsory briefing classification.
 * Weak tokens alone (meeting/site/briefing) must NOT classify as compulsory.
 */
const {
  BRIEFING_CLASSIFICATION,
  EXCEPTION_CATEGORY,
} = require('../domain/ocdsDayReconciliation')
const { raiseException } = require('./parityExceptionService')
const { getStorage } = require('./storageAdapter')

const CLASSIFICATION_VERSION = 'phase19-v1'

const STRONG_COMPULSORY = [
  /compulsory\s+briefing/i,
  /mandatory\s+briefing/i,
  /briefing\s+is\s+compulsory/i,
  /attendance\s+is\s+compulsory/i,
  /compulsory\s+site\s+(meeting|inspection|visit)/i,
  /mandatory\s+site\s+(meeting|inspection|visit)/i,
]

const STRONG_NOT_COMPULSORY = [
  /non[-\s]?compulsory\s+briefing/i,
  /optional\s+briefing/i,
  /briefing\s+is\s+not\s+compulsory/i,
  /attendance\s+is\s+optional/i,
]

const WEAK_ONLY = [/\bmeeting\b/i, /\bsite\b/i, /\bbriefing\b/i]

function collectText(tender) {
  const docs = Array.isArray(tender.documents)
    ? tender.documents.map((d) => `${d?.title || ''} ${d?.description || ''}`).join(' ')
    : ''
  const snap = tender.rawSourceSnapshot
  const snapText = snap
    ? JSON.stringify({
        briefingSession: snap.briefingSession,
        title: snap.title,
        description: snap.description,
      })
    : ''
  return [
    tender.title,
    tender.description,
    tender.summary,
    tender.briefingVenue,
    docs,
    snapText,
  ]
    .filter(Boolean)
    .join('\n')
}

function classifyBriefing(tender) {
  const evidence = []
  const text = collectText(tender)

  if (tender.sourceBriefingCompulsory === true) {
    evidence.push({
      kind: 'source_flag',
      detail: 'sourceBriefingCompulsory=true',
      source: 'OCDS_BRIEFING_SESSION',
    })
    return {
      classification: BRIEFING_CLASSIFICATION.CONFIRMED_COMPULSORY,
      evidence,
      source: 'sourceBriefingCompulsory',
      classifiedAt: new Date().toISOString(),
      classificationVersion: CLASSIFICATION_VERSION,
    }
  }

  if (tender.sourceBriefingCompulsory === false) {
    evidence.push({
      kind: 'source_flag',
      detail: 'sourceBriefingCompulsory=false',
      source: 'OCDS_BRIEFING_SESSION',
    })
    return {
      classification: BRIEFING_CLASSIFICATION.NOT_COMPULSORY,
      evidence,
      source: 'sourceBriefingCompulsory',
      classifiedAt: new Date().toISOString(),
      classificationVersion: CLASSIFICATION_VERSION,
    }
  }

  for (const re of STRONG_COMPULSORY) {
    if (re.test(text)) {
      evidence.push({ kind: 'strong_phrase', detail: String(re), source: 'text_scan' })
      return {
        classification: BRIEFING_CLASSIFICATION.CONFIRMED_COMPULSORY,
        evidence,
        source: 'strong_text_evidence',
        classifiedAt: new Date().toISOString(),
        classificationVersion: CLASSIFICATION_VERSION,
      }
    }
  }

  for (const re of STRONG_NOT_COMPULSORY) {
    if (re.test(text)) {
      evidence.push({ kind: 'strong_phrase', detail: String(re), source: 'text_scan' })
      return {
        classification: BRIEFING_CLASSIFICATION.NOT_COMPULSORY,
        evidence,
        source: 'strong_text_evidence',
        classifiedAt: new Date().toISOString(),
        classificationVersion: CLASSIFICATION_VERSION,
      }
    }
  }

  // Venue + date together with explicit "compulsory" nearby → likely
  const hasVenue = Boolean(String(tender.briefingVenue || '').trim())
  const hasDate = Boolean(String(tender.briefingDate || '').trim())
  if (hasVenue && hasDate && /compulsory|mandatory/i.test(text)) {
    evidence.push({
      kind: 'composite',
      detail: 'briefingDate+venue+compulsory/mandatory token',
      source: 'composite',
    })
    return {
      classification: BRIEFING_CLASSIFICATION.LIKELY_COMPULSORY,
      evidence,
      source: 'composite_evidence',
      classifiedAt: new Date().toISOString(),
      classificationVersion: CLASSIFICATION_VERSION,
    }
  }

  // Weak tokens alone → UNKNOWN (never CONFIRMED/LIKELY)
  const weakHit = WEAK_ONLY.some((re) => re.test(text))
  if (weakHit) {
    evidence.push({
      kind: 'weak_token_only',
      detail: 'meeting/site/briefing without strong compulsory evidence',
      source: 'weak_guard',
    })
  }

  return {
    classification: BRIEFING_CLASSIFICATION.UNKNOWN,
    evidence,
    source: weakHit ? 'weak_guard' : 'insufficient_evidence',
    classifiedAt: new Date().toISOString(),
    classificationVersion: CLASSIFICATION_VERSION,
  }
}

function applyClassification(tender, result) {
  return {
    ...tender,
    briefingClassification: result.classification,
    briefingClassificationEvidence: result.evidence,
    briefingClassificationSource: result.source,
    briefingClassifiedAt: result.classifiedAt,
    classificationVersion: result.classificationVersion,
  }
}

async function classifyMirrorBatch({ limit = 500, raiseReviews = true } = {}) {
  const storage = getStorage()
  const all = await storage.getTenderBriefings({ limit: Math.min(limit * 2, 5000) })
  const updates = []
  const counts = {
    CONFIRMED_COMPULSORY: 0,
    LIKELY_COMPULSORY: 0,
    NOT_COMPULSORY: 0,
    UNKNOWN: 0,
  }

  for (const tender of (all || []).slice(0, limit)) {
    const result = classifyBriefing(tender)
    counts[result.classification] = (counts[result.classification] || 0) + 1
    updates.push(applyClassification(tender, result))

    if (
      raiseReviews &&
      (result.classification === BRIEFING_CLASSIFICATION.LIKELY_COMPULSORY ||
        (result.classification === BRIEFING_CLASSIFICATION.UNKNOWN &&
          result.evidence.some((e) => e.kind === 'weak_token_only')))
    ) {
      await raiseException({
        category: EXCEPTION_CATEGORY.BRIEFING_CLASSIFICATION_REVIEW,
        tenderNumber: tender.tenderNumber,
        ocid: tender.ocid,
        title: tender.title,
        detail: `classification=${result.classification}`,
        payload: result,
      })
    }
  }

  if (updates.length) await storage.upsertTenders(updates)
  return { scanned: updates.length, counts, classificationVersion: CLASSIFICATION_VERSION }
}

module.exports = {
  CLASSIFICATION_VERSION,
  BRIEFING_CLASSIFICATION,
  classifyBriefing,
  applyClassification,
  classifyMirrorBatch,
  STRONG_COMPULSORY,
  WEAK_ONLY,
}
