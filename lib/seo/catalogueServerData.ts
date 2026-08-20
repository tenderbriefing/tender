import { backend } from '@/lib/backend/loadServices'
import { filterPlatformVisible } from '@/lib/security/publicTender'
import type { TenderBriefing } from '@/lib/tenderBriefing/types'

/** Matches public catalogue API default — one bounded page read. */
export const CATALOGUE_PAGE_SIZE = 40

/** Firestore scan budget aligned with listTenderBriefingsPage defaults. */
export const CATALOGUE_SCAN_BUDGET = 160

/** Maximum items collected for programmatic browse SSR (single page + in-memory filter). */
export const PROGRAMMATIC_BROWSE_SCAN_BUDGET = 160

export const PROGRAMMATIC_BROWSE_LIMIT = 12

export type CataloguePageResult = {
  tenders: TenderBriefing[]
  nextCursor: string | null
  hasMore: boolean
  scanned: number
  pageSize: number
  lastUpdated: string | null
}

async function readSyncLastUpdated(): Promise<string | null> {
  try {
    const sync = backend.incrementalSync()
    const status = await sync.getSyncStatus()
    const raw =
      (typeof status.lastSuccessfulSync === 'string' && status.lastSuccessfulSync) ||
      (typeof status.lastUpdated === 'string' && status.lastUpdated) ||
      null
    return raw
  } catch {
    return null
  }
}

/**
 * Fetch the first catalogue page for SSR — mirrors `/api/tender-briefings` bounds.
 * Exactly one paginated storage read (or bounded JSON fallback).
 */
export async function getCatalogueInitialPage(options?: {
  province?: string
  pageSize?: number
}): Promise<CataloguePageResult> {
  const pageSize = Math.min(Math.max(options?.pageSize ?? CATALOGUE_PAGE_SIZE, 1), 100)
  const storage = backend.getStorage()
  const lastUpdated = await readSyncLastUpdated()

  try {
    if (typeof storage.listTenderBriefingsPage === 'function') {
      const page = await storage.listTenderBriefingsPage({
        pageSize,
        scanBudget: CATALOGUE_SCAN_BUDGET,
        province: options?.province,
        compulsoryOnly: true,
      })
      const tenders = filterPlatformVisible(page.items, null)
      return {
        tenders,
        nextCursor: page.nextCursor ?? null,
        hasMore: Boolean(page.nextCursor),
        scanned: page.scanned ?? page.items.length,
        pageSize,
        lastUpdated,
      }
    }

    const bounded = await storage.getTenderBriefings({
      province: options?.province,
      limit: 400,
    })
    const visible = filterPlatformVisible(bounded, null)
    const tenders = visible.slice(0, pageSize)
    const last = tenders[tenders.length - 1]
    return {
      tenders,
      nextCursor: visible.length > pageSize && last ? last.id : null,
      hasMore: visible.length > pageSize,
      scanned: bounded.length,
      pageSize,
      lastUpdated,
    }
  } catch {
    return {
      tenders: [],
      nextCursor: null,
      hasMore: false,
      scanned: 0,
      pageSize,
      lastUpdated,
    }
  }
}

/**
 * Bounded programmatic browse data — one paginated read, optional province push-down,
 * then in-memory programmatic filter (for category/industry slugs).
 */
export async function getProgrammaticBrowseTenders(
  filter: (tender: TenderBriefing) => boolean,
  options?: { province?: string; limit?: number }
): Promise<CataloguePageResult> {
  const limit = options?.limit ?? PROGRAMMATIC_BROWSE_LIMIT
  const page = await getCatalogueInitialPage({
    province: options?.province,
    pageSize: PROGRAMMATIC_BROWSE_SCAN_BUDGET,
  })
  const filtered = page.tenders.filter(filter).slice(0, limit)
  return {
    ...page,
    tenders: filtered,
    pageSize: limit,
  }
}
