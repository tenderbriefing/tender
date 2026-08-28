import { cache } from 'react'
import { hasUpcomingBriefing } from '@/lib/procurement/dates'
import type { TenderBriefing } from '@/lib/tenderBriefing/types'
import {
  compareBriefingDateAsc,
  compareBriefingDateDesc,
  HUB_PAGE_SIZE,
  HUB_SCAN_BUDGET,
  PROVINCE_HUB_HISTORICAL_LIMIT,
  PROVINCE_HUB_UPCOMING_LIMIT,
} from './compulsoryBriefingHubs'
import { scanCompulsoryPublicTenders } from './compulsoryBriefingHubServer'
import {
  ORGANISATION_SEO_REGISTRY,
  getOrganisationBySlug,
  organisationMatchesEntry,
  resolveOrganisationFromTender,
  type OrganisationSeoEntry,
} from './organisationRegistry'
import {
  isOrganisationHubIndexable,
  organisationHubPath,
  type OrganisationHubCounts,
  ORG_DIRECTORY_MIN_INDEXABLE,
  ORG_NAV_LINK_CAP,
} from './organisationHubs'

export type OrganisationHubData = {
  entry: OrganisationSeoEntry
  upcoming: TenderBriefing[]
  historical: TenderBriefing[]
  counts: OrganisationHubCounts
  scanned: number
}

let sharedScanPromise: Promise<{ items: TenderBriefing[]; scanned: number }> | null = null

async function getSharedCompulsoryScan() {
  if (!sharedScanPromise) {
    sharedScanPromise = scanCompulsoryPublicTenders({
      pageSize: HUB_PAGE_SIZE,
      scanBudget: HUB_SCAN_BUDGET,
    }).finally(() => {
      // Allow refresh on next request cycle in long-lived processes.
      setTimeout(() => {
        sharedScanPromise = null
      }, 60_000)
    })
  }
  return sharedScanPromise
}

function splitHubLists(items: TenderBriefing[]) {
  const upcoming = items
    .filter((t) => hasUpcomingBriefing(t.briefingDate, t.briefingTime))
    .sort(compareBriefingDateAsc)
    .slice(0, PROVINCE_HUB_UPCOMING_LIMIT)

  const historical = items
    .filter((t) => !hasUpcomingBriefing(t.briefingDate, t.briefingTime))
    .sort(compareBriefingDateDesc)
    .slice(0, PROVINCE_HUB_HISTORICAL_LIMIT)

  const counts: OrganisationHubCounts = {
    upcoming: upcoming.length,
    historical: historical.length,
    totalPublic: items.length,
  }

  return { upcoming, historical, counts }
}

export const loadOrganisationHubData = cache(
  async (slug: string): Promise<OrganisationHubData | null> => {
    const entry = getOrganisationBySlug(slug)
    if (!entry) return null

    const { items, scanned } = await getSharedCompulsoryScan()
    const matched = items.filter((t) => organisationMatchesEntry(t, entry))
    const { upcoming, historical, counts } = splitHubLists(matched)

    return { entry, upcoming, historical, counts, scanned }
  }
)

/** Request-scoped cache so metadata + page agree on the same indexable set. */
export const listIndexableOrganisationEntries = cache(
  async (): Promise<OrganisationSeoEntry[]> => {
    const { items } = await getSharedCompulsoryScan()
    const indexable: OrganisationSeoEntry[] = []

    for (const entry of ORGANISATION_SEO_REGISTRY) {
      const matched = items.filter((t) => organisationMatchesEntry(t, entry))
      const { counts } = splitHubLists(matched)
      if (isOrganisationHubIndexable(counts)) indexable.push(entry)
    }

    return indexable
  }
)

export async function listIndexableOrganisationHubSlugs(): Promise<string[]> {
  const entries = await listIndexableOrganisationEntries()
  return entries.map((e) => e.slug)
}

export async function shouldShowOrganisationDirectory(): Promise<boolean> {
  const entries = await listIndexableOrganisationEntries()
  return entries.length >= ORG_DIRECTORY_MIN_INDEXABLE
}

export async function listOrganisationNavEntries(
  limit = ORG_NAV_LINK_CAP
): Promise<OrganisationSeoEntry[]> {
  const entries = await listIndexableOrganisationEntries()
  return entries.slice(0, limit)
}

/** Organisation hub URL only when the hub meets the index threshold. */
export async function getIndexableOrganisationHubHref(
  tender: Pick<TenderBriefing, 'department' | 'buyer'>
): Promise<{ href: string; label: string } | null> {
  const entry = resolveOrganisationFromTender(tender)
  if (!entry) return null
  const data = await loadOrganisationHubData(entry.slug)
  if (!data || !isOrganisationHubIndexable(data.counts)) return null
  return {
    href: organisationHubPath(entry.slug),
    label: entry.shortName,
  }
}
