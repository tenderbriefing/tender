import type { TenderBriefing } from '@/lib/tenderBriefing/types'

/** Max characters accepted for a public search query. */
export const TENDER_SEARCH_MAX_QUERY_LENGTH = 120

/** Default max ranked results returned by the search API. */
export const TENDER_SEARCH_DEFAULT_LIMIT = 40

/** Hard cap on Firestore docs scanned per search request. */
export const TENDER_SEARCH_SCAN_BUDGET = 800

export type TenderSearchMatchKind =
  | 'tender_number_exact'
  | 'tender_number'
  | 'title'
  | 'organisation'
  | 'category'
  | 'province'
  | 'description'
  | 'none'

export type RankedTenderSearchResult = {
  tender: TenderBriefing
  score: number
  matchKind: TenderSearchMatchKind
}

/**
 * Sanitize and normalize a user search query.
 * Returns empty string when the query is not usable.
 */
export function normalizeTenderSearchQuery(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  return raw
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, TENDER_SEARCH_MAX_QUERY_LENGTH)
}

export function tokenizeTenderSearchQuery(normalized: string): string[] {
  if (!normalized) return []
  return normalized
    .toLowerCase()
    .split(/[\s,/|;]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .slice(0, 12)
}

function fieldIncludes(hay: string, needle: string): boolean {
  return Boolean(hay && needle && hay.includes(needle))
}

function scoreField(
  hayLower: string,
  token: string,
  weights: { exact: number; prefix: number; includes: number }
): number {
  if (!hayLower || !token) return 0
  if (hayLower === token) return weights.exact
  if (hayLower.startsWith(token) || hayLower.includes(` ${token}`)) return weights.prefix
  if (hayLower.includes(token)) return weights.includes
  return 0
}

/**
 * Score a single tender against a normalized query.
 * Higher is better. Zero means no match.
 */
export function scoreTenderAgainstQuery(
  tender: TenderBriefing,
  normalizedQuery: string
): RankedTenderSearchResult {
  const tokens = tokenizeTenderSearchQuery(normalizedQuery)
  if (tokens.length === 0) {
    return { tender, score: 0, matchKind: 'none' }
  }

  const tenderNumber = String(tender.tenderNumber || '').toLowerCase()
  const title = String(tender.title || '').toLowerCase()
  const department = String(tender.department || '').toLowerCase()
  const buyer = String(tender.buyer || '').toLowerCase()
  const org = `${department} ${buyer}`.trim()
  const category = `${tender.category || ''} ${tender.industrySector || ''}`.toLowerCase()
  const province = String(tender.province || '').toLowerCase()
  const description = `${tender.summary || ''} ${tender.description || ''}`.toLowerCase()
  const fullQuery = normalizedQuery.toLowerCase()

  let score = 0
  let matchKind: TenderSearchMatchKind = 'none'

  // Exact / strong tender-number match for the full query string
  if (tenderNumber && tenderNumber === fullQuery) {
    score += 1000
    matchKind = 'tender_number_exact'
  } else if (tenderNumber && fieldIncludes(tenderNumber, fullQuery)) {
    score += 800
    matchKind = 'tender_number'
  }

  // Every token must appear somewhere (whitespace-tolerant multi-term)
  let tokensMatched = 0
  for (const token of tokens) {
    const hay =
      `${tenderNumber} ${title} ${org} ${category} ${province} ${description}`
    if (!fieldIncludes(hay, token)) {
      return { tender, score: 0, matchKind: 'none' }
    }
    tokensMatched += 1

    const numScore = scoreField(tenderNumber, token, {
      exact: 220,
      prefix: 180,
      includes: 140,
    })
    const titleScore = scoreField(title, token, { exact: 160, prefix: 120, includes: 90 })
    const orgScore = scoreField(org, token, { exact: 130, prefix: 100, includes: 70 })
    const catScore = scoreField(category, token, { exact: 80, prefix: 60, includes: 45 })
    const provScore = scoreField(province, token, { exact: 50, prefix: 40, includes: 30 })
    const descScore = scoreField(description, token, { exact: 40, prefix: 28, includes: 18 })

    const best = Math.max(numScore, titleScore, orgScore, catScore, provScore, descScore)
    score += best

    if (matchKind === 'none' || matchKind === 'description' || matchKind === 'province') {
      if (numScore >= best && numScore > 0) matchKind = 'tender_number'
      else if (titleScore >= best && titleScore > 0) matchKind = 'title'
      else if (orgScore >= best && orgScore > 0) matchKind = 'organisation'
      else if (catScore >= best && catScore > 0) matchKind = 'category'
      else if (provScore >= best && provScore > 0) matchKind = 'province'
      else if (descScore > 0) matchKind = 'description'
    }
  }

  if (tokensMatched !== tokens.length || score <= 0) {
    return { tender, score: 0, matchKind: 'none' }
  }

  // Prefer active status slightly
  if (tender.status === 'active') score += 5

  return { tender, score, matchKind }
}

/**
 * Filter + rank tenders for a query. Active/upcoming catalogue lists are expected as input.
 */
export function rankTendersForQuery(
  tenders: TenderBriefing[],
  rawQuery: unknown,
  options?: { limit?: number }
): RankedTenderSearchResult[] {
  const q = normalizeTenderSearchQuery(rawQuery)
  if (!q) return []
  const limit = Math.min(Math.max(options?.limit ?? TENDER_SEARCH_DEFAULT_LIMIT, 1), 100)

  const ranked: RankedTenderSearchResult[] = []
  for (const tender of tenders) {
    const hit = scoreTenderAgainstQuery(tender, q)
    if (hit.score > 0) ranked.push(hit)
  }

  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    const aClose = a.tender.closingDate ? new Date(a.tender.closingDate).getTime() : Number.MAX_SAFE_INTEGER
    const bClose = b.tender.closingDate ? new Date(b.tender.closingDate).getTime() : Number.MAX_SAFE_INTEGER
    if (aClose !== bClose) return aClose - bClose
    return String(a.tender.title || '').localeCompare(String(b.tender.title || ''))
  })

  return ranked.slice(0, limit)
}

/** True when a tender matches the query (for client-side catalogue filter parity). */
export function tenderMatchesSearchQuery(tender: TenderBriefing, rawQuery: unknown): boolean {
  const q = normalizeTenderSearchQuery(rawQuery)
  if (!q) return true
  return scoreTenderAgainstQuery(tender, q).score > 0
}

export function buildTendersSearchHref(opts: {
  q?: string
  province?: string
}): string {
  const params = new URLSearchParams()
  const q = normalizeTenderSearchQuery(opts.q)
  if (q) params.set('q', q)
  const province = normalizeTenderSearchQuery(opts.province)
  if (province) params.set('province', province.slice(0, 80))
  const qs = params.toString()
  return qs ? `/tenders?${qs}` : '/tenders'
}
