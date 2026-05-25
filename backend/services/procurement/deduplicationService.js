/**
 * Multi-source procurement deduplication — extends legacy rules with cross-source matching.
 */
const legacyDedup = require('../deduplicationService')
const { getFirestore } = require('../../config/firebaseAdmin')
const { sanitizeFirestoreData } = require('../../utils/sanitizeFirestoreData')

function normalizeNumber(n) {
  return String(n || '')
    .replace(/\s+/g, '')
    .toUpperCase()
}

function pdfFingerprint(url) {
  if (!url) return null
  try {
    const u = new URL(url)
    return u.pathname.split('/').pop()?.toLowerCase() || null
  } catch {
    return String(url).slice(-64)
  }
}

function isCrossSourceDuplicate(existing, candidate, options = {}) {
  const legacy = legacyDedup.isDuplicate(existing, candidate, options)
  if (legacy.duplicate) return legacy

  if (
    existing.source &&
    candidate.source &&
    existing.source !== candidate.source &&
    existing.tenderNumber &&
    candidate.tenderNumber &&
    normalizeNumber(existing.tenderNumber) === normalizeNumber(candidate.tenderNumber)
  ) {
    return { duplicate: true, reason: 'cross_source_same_number' }
  }

  const fpA = pdfFingerprint(existing.rawSourceData?.url || existing.attachments?.[0]?.url)
  const fpB = pdfFingerprint(candidate.rawSourceData?.url || candidate.attachments?.[0]?.url)
  if (fpA && fpB && fpA === fpB) {
    return { duplicate: true, reason: 'duplicate_pdf' }
  }

  if (
    existing.department &&
    candidate.department &&
    existing.briefingDate &&
    candidate.briefingDate &&
    existing.briefingDate === candidate.briefingDate &&
    legacyDedup.titleSimilarity(existing.title, candidate.title) >= 0.9
  ) {
    return { duplicate: true, reason: 'duplicate_briefing_notice' }
  }

  return { duplicate: false }
}

function findDuplicateInList(list, candidate, options = {}) {
  for (const existing of list) {
    const check = isCrossSourceDuplicate(existing, candidate, options)
    if (check.duplicate) return { existing, ...check }
  }
  return null
}

async function scoreAiSimilarity(titleA, titleB) {
  const sim = legacyDedup.titleSimilarity(titleA, titleB)
  return { score: sim, aiEnhanced: false }
}

async function deduplicateBatch(incoming, existingList, options = {}) {
  const stats = { added: 0, skipped: 0, duplicates: [] }
  const merged = [...existingList]

  for (const candidate of incoming) {
    const dup = findDuplicateInList(merged, candidate, options)
    if (dup) {
      stats.skipped += 1
      stats.duplicates.push({
        reason: dup.reason,
        title: candidate.title,
        source: candidate.source,
      })
      continue
    }
    merged.push(candidate)
    stats.added += 1
  }

  return { merged, stats }
}

async function logDuplicateEvent(entry) {
  const db = getFirestore()
  const ref = db.collection('procurementSourceLogs').doc()
  await ref.set(
    sanitizeFirestoreData({
      ...entry,
      type: 'deduplication',
      createdAt: new Date().toISOString(),
    })
  )
  return ref.id
}

module.exports = {
  isCrossSourceDuplicate,
  findDuplicateInList,
  deduplicateBatch,
  scoreAiSimilarity,
  logDuplicateEvent,
}
