import type { TenderBriefing } from '@/lib/tenderBriefing/types'
import { buildMatchingKeywords } from '@/lib/data/csdProcurementCatalog'

export type SmeMatchingProfile = {
  categories?: string[]
  commodities?: string[]
  sectors?: string[]
  province?: string
}

function tenderSearchText(tender: TenderBriefing): string {
  return [
    tender.title,
    tender.description,
    tender.summary,
    tender.category,
    tender.industrySector,
    tender.department,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

/** Score 0–100 for how well a tender matches SME category/commodity selections. */
export function scoreTenderForSme(
  tender: TenderBriefing,
  profile: SmeMatchingProfile
): number {
  const categories = profile.categories || profile.sectors || []
  const commodities = profile.commodities || []
  if (categories.length === 0 && commodities.length === 0) return 50

  const keywords = buildMatchingKeywords(categories, commodities)
  const haystack = tenderSearchText(tender)
  if (!haystack) return 40

  let score = 35
  let hits = 0
  for (const kw of keywords) {
    if (kw.length < 3) continue
    if (haystack.includes(kw)) {
      hits += 1
      const isCommodity = commodities.some((c) => c.toLowerCase() === kw)
      score += isCommodity ? 8 : 5
    }
  }

  for (const cat of categories) {
    if (haystack.includes(cat.toLowerCase())) score += 10
  }

  if (profile.province && tender.province === profile.province) score += 12
  if (tender.briefingCompulsory) score += 5

  return Math.min(100, Math.max(0, score + Math.min(hits * 2, 20)))
}

export function sortTendersForSme<T extends TenderBriefing>(
  tenders: T[],
  profile: SmeMatchingProfile
): T[] {
  return [...tenders].sort(
    (a, b) => scoreTenderForSme(b, profile) - scoreTenderForSme(a, profile)
  )
}

export function filterRelevantTenders<T extends TenderBriefing>(
  tenders: T[],
  profile: SmeMatchingProfile,
  minScore = 45
): T[] {
  const categories = profile.categories || profile.sectors || []
  const commodities = profile.commodities || []
  if (categories.length === 0 && commodities.length === 0) return tenders

  return tenders.filter((t) => scoreTenderForSme(t, profile) >= minScore)
}
