function normalizeTitle(title = '') {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function titleSimilarity(a, b) {
  const na = normalizeTitle(a)
  const nb = normalizeTitle(b)
  if (!na || !nb) return 0
  if (na === nb) return 1

  const wordsA = new Set(na.split(' '))
  const wordsB = new Set(nb.split(' '))
  const intersection = [...wordsA].filter((w) => wordsB.has(w)).length
  const union = new Set([...wordsA, ...wordsB]).size
  return union === 0 ? 0 : intersection / union
}

function isDuplicate(existing, candidate, options = {}) {
  const titleThreshold = options.titleThreshold ?? 0.85

  if (existing.ocid && candidate.ocid && existing.ocid === candidate.ocid) {
    return { duplicate: true, reason: 'same_ocid' }
  }

  if (
    existing.tenderNumber &&
    candidate.tenderNumber &&
    existing.tenderNumber === candidate.tenderNumber
  ) {
    return { duplicate: true, reason: 'same_tender_number' }
  }

  if (
    existing.department &&
    candidate.department &&
    existing.closingDate &&
    candidate.closingDate &&
    existing.department === candidate.department &&
    existing.closingDate === candidate.closingDate &&
    titleSimilarity(existing.title, candidate.title) >= titleThreshold
  ) {
    return { duplicate: true, reason: 'same_department_closing_similar_title' }
  }

  if (titleSimilarity(existing.title, candidate.title) >= 0.95) {
    return { duplicate: true, reason: 'similar_title' }
  }

  return { duplicate: false }
}

function deduplicateTenders(existingTenders, incomingTenders) {
  const merged = [...existingTenders]
  const stats = { added: 0, updated: 0, skipped: 0, duplicates: [] }

  for (const candidate of incomingTenders) {
    const matchIndex = merged.findIndex((existing) =>
      isDuplicate(existing, candidate).duplicate
    )

    if (matchIndex >= 0) {
      const duplicateCheck = isDuplicate(merged[matchIndex], candidate)
      if (duplicateCheck.duplicate) {
        merged[matchIndex] = {
          ...merged[matchIndex],
          ...candidate,
          id: merged[matchIndex].id || candidate.id,
          history: merged[matchIndex].history || candidate.history || [],
        }
        stats.updated += 1
        stats.duplicates.push({
          reason: duplicateCheck.reason,
          id: merged[matchIndex].id,
          title: candidate.title,
        })
        continue
      }
    }

    merged.push(candidate)
    stats.added += 1
  }

  return { tenders: merged, stats }
}

function findDuplicateInList(tenders, candidate) {
  return tenders.find((existing) => isDuplicate(existing, candidate).duplicate) || null
}

module.exports = {
  normalizeTitle,
  titleSimilarity,
  isDuplicate,
  deduplicateTenders,
  findDuplicateInList,
}
