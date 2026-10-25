/**
 * Phase 20 — Sample CONFIRMED_COMPULSORY classifications for false positives.
 */
const { BRIEFING_CLASSIFICATION } = require('../domain/ocdsDayReconciliation')
const { classifyBriefing, WEAK_ONLY, STRONG_COMPULSORY } = require('./briefingClassificationService')
const { getStorage } = require('./storageAdapter')

function looksLikeWeakOnlyFalsePositive(tender, result) {
  if (result.classification !== BRIEFING_CLASSIFICATION.CONFIRMED_COMPULSORY) return false
  // Source flag is authoritative — not a FP
  if (tender.sourceBriefingCompulsory === true) return false
  if (result.source === 'sourceBriefingCompulsory') return false
  if (result.source === 'strong_text_evidence') return false
  // Confirmed without strong evidence → suspect
  const hasStrong = (result.evidence || []).some(
    (e) => e.kind === 'strong_phrase' || e.kind === 'source_flag'
  )
  return !hasStrong
}

async function sampleConfirmedCompulsory({ sampleSize = 25 } = {}) {
  const storage = getStorage()
  const all = await storage.getTenderBriefings({ limit: 5000 })
  const confirmed = (all || []).filter(
    (t) => t.briefingClassification === BRIEFING_CLASSIFICATION.CONFIRMED_COMPULSORY
  )
  const sample = confirmed.slice(0, sampleSize)
  const results = []
  let falsePositives = 0

  for (const tender of sample) {
    const reclass = classifyBriefing(tender)
    const fp = looksLikeWeakOnlyFalsePositive(tender, reclass)
    if (fp) falsePositives += 1
    results.push({
      id: tender.id,
      tenderNumber: tender.tenderNumber,
      title: tender.title,
      storedClassification: tender.briefingClassification,
      reclassified: reclass.classification,
      source: reclass.source,
      evidence: reclass.evidence,
      falsePositiveSuspect: fp,
      sourceBriefingCompulsory: tender.sourceBriefingCompulsory ?? null,
    })
  }

  return {
    population: confirmed.length,
    sampleSize: sample.length,
    falsePositives,
    falsePositiveRate: sample.length ? Number((falsePositives / sample.length).toFixed(4)) : null,
    results,
  }
}

module.exports = {
  sampleConfirmedCompulsory,
  looksLikeWeakOnlyFalsePositive,
}
