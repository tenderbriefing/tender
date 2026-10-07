import { backend } from '@/lib/backend/loadServices'
import {
  filterPlatformVisible,
  toPublicTenderBriefing,
  type PlatformViewer,
} from '@/lib/security/publicTender'
import {
  normalizeTenderSearchQuery,
  rankTendersForQuery,
  TENDER_SEARCH_DEFAULT_LIMIT,
  TENDER_SEARCH_SCAN_BUDGET,
  type RankedTenderSearchResult,
} from '@/lib/procurement/tenderSearch'
import type { TenderBriefing } from '@/lib/tenderBriefing/types'

export type TenderSearchServerResult = {
  query: string
  tenders: TenderBriefing[]
  ranked: RankedTenderSearchResult[]
  resultCount: number
  scanned: number
  truncatedScan: boolean
  province: string | null
}

/**
 * Bounded catalogue search over upcoming compulsory briefings.
 * Pages Firestore with the existing listTenderBriefingsPage helper — no full collection download.
 */
export async function searchCatalogueTenders(options: {
  q: unknown
  province?: unknown
  limit?: number
  viewer?: PlatformViewer
  forAnonymous?: boolean
}): Promise<TenderSearchServerResult> {
  const query = normalizeTenderSearchQuery(options.q)
  const provinceRaw = normalizeTenderSearchQuery(options.province)
  const province = provinceRaw || null
  const limit = Math.min(
    Math.max(options.limit ?? TENDER_SEARCH_DEFAULT_LIMIT, 1),
    100
  )
  const viewer = options.viewer ?? null

  if (!query) {
    return {
      query: '',
      tenders: [],
      ranked: [],
      resultCount: 0,
      scanned: 0,
      truncatedScan: false,
      province,
    }
  }

  const storage = backend.getStorage()
  const collected: TenderBriefing[] = []
  let scanned = 0
  let cursor: string | undefined
  let truncatedScan = false

  if (typeof storage.listTenderBriefingsPage === 'function') {
    while (scanned < TENDER_SEARCH_SCAN_BUDGET) {
      const pageSize = Math.min(80, TENDER_SEARCH_SCAN_BUDGET - scanned)
      const page = await storage.listTenderBriefingsPage({
        pageSize,
        scanBudget: Math.min(240, pageSize * 2),
        cursor,
        province: province || undefined,
        compulsoryOnly: true,
      })
      scanned += page.scanned ?? page.items.length
      const visible = filterPlatformVisible(page.items, viewer)
      collected.push(...visible)
      if (!page.nextCursor) break
      cursor = page.nextCursor
      if (scanned >= TENDER_SEARCH_SCAN_BUDGET) {
        truncatedScan = true
        break
      }
    }
  } else {
    const bounded = await storage.getTenderBriefings({
      province: province || undefined,
      limit: Math.min(TENDER_SEARCH_SCAN_BUDGET, 400),
    })
    scanned = bounded.length
    collected.push(...filterPlatformVisible(bounded, viewer))
    truncatedScan = bounded.length >= 400
  }

  const ranked = rankTendersForQuery(collected, query, { limit })
  const tenders = ranked.map((r) =>
    options.forAnonymous ? (toPublicTenderBriefing(r.tender) as TenderBriefing) : r.tender
  )

  return {
    query,
    tenders,
    ranked: ranked.map((r, i) => ({ ...r, tender: tenders[i] })),
    resultCount: ranked.length,
    scanned,
    truncatedScan,
    province,
  }
}
