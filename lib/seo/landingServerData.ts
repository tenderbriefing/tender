import { getPublicTenders } from '@/lib/seo/publicTenders'
import { getPublicProcurementStats } from '@/lib/seo/publicStats'
import { getLandingTenderFilter } from '@/lib/seo/landingFilters'
import type { PublicTenderStats } from '@/lib/security/publicTender'
import type { TenderBriefing } from '@/lib/tenderBriefing/types'

export async function getLandingPageTenders(
  slug: string,
  limit = 8
): Promise<TenderBriefing[]> {
  try {
    const tenders = await getPublicTenders()
    const filter = getLandingTenderFilter(slug)
    return tenders.filter(filter).slice(0, limit)
  } catch {
    return []
  }
}

export function getTendersLastSynced(tenders: TenderBriefing[]): string | null {
  if (tenders.length === 0) return null
  const timestamps = tenders
    .map((t) => t.lastSyncedAt || t.scrapedAt)
    .filter(Boolean)
    .map((value) => new Date(value).getTime())
    .filter((value) => !Number.isNaN(value))
  if (timestamps.length === 0) return null
  return new Date(Math.max(...timestamps)).toISOString()
}

export async function getSeoLandingServerData(slug: string, tenderLimit = 8) {
  const [initialStats, initialTenders] = await Promise.all([
    getPublicProcurementStats(),
    getLandingPageTenders(slug, tenderLimit),
  ])

  return {
    initialStats,
    initialTenders,
    initialLastUpdated: getTendersLastSynced(initialTenders),
  } satisfies {
    initialStats: PublicTenderStats
    initialTenders: TenderBriefing[]
    initialLastUpdated: string | null
  }
}
