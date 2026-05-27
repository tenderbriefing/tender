import type { TenderBriefing } from '@/lib/tenderBriefing/types'

/** Collapse whitespace only — preserve original casing and wording from eTenders. */
function normalizeWhitespace(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim()
}

function isGeneratedSummary(text: string, title: string): boolean {
  const lower = text.toLowerCase()
  const titleLower = title.toLowerCase()
  if (lower.startsWith(titleLower) && lower.includes('issued by')) return true
  if (lower.includes('compulsory briefing on') && lower.includes('closes ')) return true
  return false
}

/**
 * Official scope/description text as published on National Treasury eTenders.
 * Uses the OCDS description field verbatim (e.g. "DEMOLITION OF CONCRETE FLOORS…").
 */
export function getOfficialEtendersScope(
  tender: Pick<TenderBriefing, 'title' | 'description' | 'summary'>
): string {
  const title = normalizeWhitespace(tender.title || '')
  const description = normalizeWhitespace(tender.description || '')
  const summary = normalizeWhitespace(tender.summary || '')

  if (description.length >= 3) {
    return description
  }

  if (title.length >= 3) {
    return title
  }

  if (summary.length >= 3 && !isGeneratedSummary(summary, title)) {
    return summary
  }

  return ''
}

export interface DerivedTenderDescription {
  /** Verbatim official scope from eTenders (description field). */
  officialScope: string
  /** @deprecated Use officialScope — kept for existing callers. */
  headline: string
  tags: string[]
  isFallback: boolean
}

export function deriveTenderDescription(tender: TenderBriefing): DerivedTenderDescription {
  const officialScope = getOfficialEtendersScope(tender)

  const tagSet = new Set<string>()
  if (tender.industrySector) tagSet.add(tender.industrySector)
  if (tender.category && tender.category.toLowerCase() !== (tender.industrySector || '').toLowerCase()) {
    tagSet.add(tender.category)
  }
  if (tender.procurementMethod) tagSet.add(tender.procurementMethod)
  if (tender.province) tagSet.add(tender.province)
  const matched = Array.isArray(tender.matchedBriefingTerms) ? tender.matchedBriefingTerms : []
  matched.slice(0, 3).forEach((m) => m && tagSet.add(m))

  return {
    officialScope,
    headline: officialScope,
    tags: Array.from(tagSet).slice(0, 6),
    isFallback: officialScope.length === 0,
  }
}
