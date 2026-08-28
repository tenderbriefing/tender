import { backend } from '@/lib/backend/loadServices'
import { hasUpcomingBriefing } from '@/lib/procurement/dates'
import type { TenderBriefing } from '@/lib/tenderBriefing/types'
import {
  organisationMatchesEntry,
  resolveOrganisationFromTender,
  ORGANISATION_SEO_REGISTRY,
  type OrganisationSeoEntry,
} from './organisationRegistry'
import { isOrganisationHubIndexable } from './organisationHubs'

/** Max Firestore documents scanned per organisation hub load. */
export const ORG_HUB_SCAN_BUDGET = 600

/** Shared catalogue pass reused to warm per-organisation lookups (sitemap/directory/build). */
export const ORG_SHARED_BUCKET_SCAN_BUDGET = 600

/** Per-request batch size when paginating compulsory catalogue scans. */
export const ORG_HUB_BATCH_SCAN = 80

/** Max matching compulsory public tenders retained per organisation hub. */
export const ORG_HUB_MATCH_LIMIT = 80

type BucketScanState = {
  buckets: Map<string, TenderBriefing[]>
  scanned: number
  exhausted: boolean
  lastCursor?: string
}

let sharedBucketPromise: Promise<BucketScanState> | null = null
const orgScanCache = new Map<
  string,
  { at: number; items: TenderBriefing[]; scanned: number }
>()
const ORG_SCAN_CACHE_MS = 60_000

function isPublicCompulsory(tender: TenderBriefing): boolean {
  return tender.briefingCompulsory === true && tender.visibility !== 'private'
}

function indexThresholdMet(items: TenderBriefing[]): boolean {
  const upcoming = items.filter((t) => hasUpcomingBriefing(t.briefingDate, t.briefingTime)).length
  const historical = items.length - upcoming
  return isOrganisationHubIndexable({ upcoming, historical, totalPublic: items.length })
}

function dedupeTenders(items: TenderBriefing[]): TenderBriefing[] {
  const seen = new Set<string>()
  const out: TenderBriefing[] = []
  for (const item of items) {
    if (!item.id || seen.has(item.id)) continue
    seen.add(item.id)
    out.push(item)
  }
  return out
}

async function paginateCompulsoryCatalogue(options: {
  scanBudget: number
  cursor?: string
  onBatch: (items: TenderBriefing[]) => boolean | void
}): Promise<{ scanned: number; exhausted: boolean; lastCursor?: string }> {
  const storage = backend.getStorage()
  let scanned = 0
  let cursor = options.cursor
  let exhausted = false
  let lastCursor: string | undefined

  if (typeof storage.listTenderBriefingsPage !== 'function') {
    const fallback = await storage.getTenderBriefings({
      compulsoryOnly: true,
      limit: Math.min(options.scanBudget, 500),
    })
    for (const item of fallback || []) {
      if (!isPublicCompulsory(item)) continue
      const stop = options.onBatch([item])
      if (stop) break
    }
    return { scanned: fallback?.length ?? 0, exhausted: true }
  }

  while (scanned < options.scanBudget && !exhausted) {
    const batchBudget = Math.min(ORG_HUB_BATCH_SCAN, options.scanBudget - scanned)
    const page = await storage.listTenderBriefingsPage({
      pageSize: 100,
      scanBudget: batchBudget,
      cursor,
    })

    const pageScanned = Math.min(page.scanned ?? 0, batchBudget)
    scanned += pageScanned
    lastCursor = page.nextCursor || lastCursor

    const publicItems = (page.items || []).filter(isPublicCompulsory)
    const stop = options.onBatch(publicItems)
    if (stop) break

    if (!page.nextCursor || pageScanned < batchBudget) {
      exhausted = true
    } else {
      cursor = page.nextCursor
    }
  }

  return { scanned, exhausted, lastCursor: cursor || lastCursor }
}

/** One bounded pass that buckets compulsory tenders by registry organisation. */
export async function scanOrganisationHubBuckets(
  scanBudget = ORG_SHARED_BUCKET_SCAN_BUDGET
): Promise<BucketScanState> {
  const buckets = new Map<string, TenderBriefing[]>()
  for (const entry of ORGANISATION_SEO_REGISTRY) {
    buckets.set(entry.slug, [])
  }

  const { scanned, exhausted, lastCursor } = await paginateCompulsoryCatalogue({
    scanBudget,
    onBatch(items) {
      for (const item of items) {
        const entry = resolveOrganisationFromTender(item)
        if (!entry) continue
        if (!organisationMatchesEntry(item, entry)) continue
        const bucket = buckets.get(entry.slug)
        if (!bucket) continue
        if (bucket.length >= ORG_HUB_MATCH_LIMIT) continue
        bucket.push(item)
      }
    },
  })

  return { buckets, scanned, exhausted, lastCursor }
}

async function getSharedBucketScan(): Promise<BucketScanState> {
  if (!sharedBucketPromise) {
    sharedBucketPromise = scanOrganisationHubBuckets().finally(() => {
      setTimeout(() => {
        sharedBucketPromise = null
      }, ORG_SCAN_CACHE_MS)
    })
  }
  return sharedBucketPromise
}

function needsDeepOrganisationScan(
  items: TenderBriefing[],
  bucket: BucketScanState
): boolean {
  if (indexThresholdMet(items)) return false
  if (bucket.exhausted) return false
  return bucket.scanned < ORG_HUB_SCAN_BUDGET
}

async function scanCompulsoryPublicTendersForOrganisationDeep(
  entry: OrganisationSeoEntry,
  options: {
    scanBudget: number
    seedItems?: TenderBriefing[]
    startCursor?: string
  }
): Promise<{ items: TenderBriefing[]; scanned: number }> {
  const matched = [...(options.seedItems || [])]
  let scanned = 0

  const { scanned: deepScanned } = await paginateCompulsoryCatalogue({
    scanBudget: options.scanBudget,
    cursor: options.startCursor,
    onBatch(items) {
      for (const item of items) {
        if (!organisationMatchesEntry(item, entry)) continue
        matched.push(item)
        if (matched.length >= ORG_HUB_MATCH_LIMIT) return true
        if (indexThresholdMet(matched)) return true
      }
      return false
    },
  })

  scanned += deepScanned
  return { items: dedupeTenders(matched).slice(0, ORG_HUB_MATCH_LIMIT), scanned }
}

/**
 * Paginate the compulsory public catalogue (newest first) and collect tenders
 * belonging to one registry organisation. Bounded — does not load the full collection.
 */
export async function scanCompulsoryPublicTendersForOrganisation(
  entry: OrganisationSeoEntry,
  options?: { scanBudget?: number; matchLimit?: number }
): Promise<{ items: TenderBriefing[]; scanned: number }> {
  const scanBudget = options?.scanBudget ?? ORG_HUB_SCAN_BUDGET
  const cacheKey = `${entry.slug}:${scanBudget}`
  const cached = orgScanCache.get(cacheKey)
  if (cached && Date.now() - cached.at < ORG_SCAN_CACHE_MS) {
    return { items: cached.items, scanned: cached.scanned }
  }

  const bucketScan = await getSharedBucketScan()
  let items = [...(bucketScan.buckets.get(entry.slug) || [])]
  let scanned = bucketScan.scanned

  if (needsDeepOrganisationScan(items, bucketScan)) {
    const remaining = Math.max(0, scanBudget - bucketScan.scanned)
    if (remaining > 0 && bucketScan.lastCursor) {
      const deep = await scanCompulsoryPublicTendersForOrganisationDeep(entry, {
        scanBudget: remaining,
        seedItems: items,
        startCursor: bucketScan.lastCursor,
      })
      items = deep.items
      scanned += deep.scanned
    }
  }

  items = dedupeTenders(items).slice(0, options?.matchLimit ?? ORG_HUB_MATCH_LIMIT)
  const result = { items, scanned }
  orgScanCache.set(cacheKey, { at: Date.now(), ...result })
  return result
}

/** @internal Test helper */
export function resetOrganisationHubScanCache() {
  orgScanCache.clear()
  sharedBucketPromise = null
}
