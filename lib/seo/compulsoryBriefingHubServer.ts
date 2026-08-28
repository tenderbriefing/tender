import { backend } from '@/lib/backend/loadServices'
import {
  hasUpcomingBriefing,
  resolveBriefingDateTime,
} from '@/lib/procurement/dates'
import type { SaProvince } from '@/lib/procurement/provinces'
import type { TenderBriefing } from '@/lib/tenderBriefing/types'
import {
  briefingInstantInRange,
  getBriefingPeriodRange,
  type BriefingPeriodSlug,
} from './compulsoryBriefingPeriods'
import {
  compareBriefingDateAsc,
  compareBriefingDateDesc,
  HUB_PAGE_SIZE,
  HUB_SCAN_BUDGET,
  PERIOD_HUB_LIMIT,
  PROVINCE_HUB_HISTORICAL_LIMIT,
  PROVINCE_HUB_UPCOMING_LIMIT,
  type ProvinceHubCounts,
} from './compulsoryBriefingHubs'

export type ProvinceHubData = {
  province: SaProvince
  slug: string
  upcoming: TenderBriefing[]
  historical: TenderBriefing[]
  counts: ProvinceHubCounts
  scanned: number
}

export type PeriodHubData = {
  period: BriefingPeriodSlug
  range: { start: Date; end: Date }
  tenders: TenderBriefing[]
  groupedByDate: Array<{ dateLabel: string; ymd: string; tenders: TenderBriefing[] }>
  scanned: number
}

export async function scanCompulsoryPublicTenders(options?: {
  province?: string
  pageSize?: number
  scanBudget?: number
}): Promise<{ items: TenderBriefing[]; scanned: number }> {
  const storage = backend.getStorage()
  const pageSize = options?.pageSize ?? HUB_PAGE_SIZE
  const scanBudget = options?.scanBudget ?? HUB_SCAN_BUDGET

  if (typeof storage.listTenderBriefingsPage !== 'function') {
    const fallback = await storage.getTenderBriefings({
      province: options?.province,
      limit: Math.min(pageSize, 100),
    })
    const items = (fallback || []).filter(
      (t) => t.briefingCompulsory && t.visibility !== 'private'
    )
    return { items, scanned: items.length }
  }

  const page = await storage.listTenderBriefingsPage({
    province: options?.province,
    pageSize,
    scanBudget,
  })
  const items = (page.items || []).filter(
    (t) => t.briefingCompulsory && t.visibility !== 'private'
  )
  return { items, scanned: page.scanned ?? items.length }
}

export async function loadProvinceHubData(
  province: SaProvince,
  slug: string
): Promise<ProvinceHubData> {
  const { items, scanned } = await scanCompulsoryPublicTenders({
    province,
    pageSize: HUB_PAGE_SIZE,
    scanBudget: HUB_SCAN_BUDGET,
  })

  const upcoming = items
    .filter((t) => hasUpcomingBriefing(t.briefingDate, t.briefingTime))
    .sort(compareBriefingDateAsc)
    .slice(0, PROVINCE_HUB_UPCOMING_LIMIT)

  const historical = items
    .filter((t) => !hasUpcomingBriefing(t.briefingDate, t.briefingTime))
    .sort(compareBriefingDateDesc)
    .slice(0, PROVINCE_HUB_HISTORICAL_LIMIT)

  const counts: ProvinceHubCounts = {
    upcoming: upcoming.length,
    historical: historical.length,
    totalPublic: items.length,
  }

  return { province, slug, upcoming, historical, counts, scanned }
}

function formatGroupDateLabel(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00+02:00`)
  return d.toLocaleDateString('en-ZA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Africa/Johannesburg',
  })
}

function briefingSastYmd(tender: TenderBriefing): string | null {
  const instant = resolveBriefingDateTime(tender.briefingDate, tender.briefingTime)
  if (!instant) return null
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Johannesburg',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant)
}

export async function loadPeriodHubData(
  period: BriefingPeriodSlug,
  now: Date = new Date()
): Promise<PeriodHubData> {
  const range = getBriefingPeriodRange(period, now)
  const { items, scanned } = await scanCompulsoryPublicTenders({
    pageSize: HUB_PAGE_SIZE,
    scanBudget: HUB_SCAN_BUDGET,
  })

  const tenders = items
    .filter((t) => briefingInstantInRange(t, range))
    .sort(compareBriefingDateAsc)
    .slice(0, PERIOD_HUB_LIMIT)

  const byDate = new Map<string, TenderBriefing[]>()
  for (const tender of tenders) {
    const ymd = briefingSastYmd(tender)
    if (!ymd) continue
    const bucket = byDate.get(ymd) || []
    bucket.push(tender)
    byDate.set(ymd, bucket)
  }

  const groupedByDate = Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ymd, rows]) => ({
      ymd,
      dateLabel: formatGroupDateLabel(ymd),
      tenders: rows.sort(compareBriefingDateAsc),
    }))

  return { period, range, tenders, groupedByDate, scanned }
}

/** Province slugs that meet index threshold — for sitemap and internal links. */
export async function listIndexableProvinceHubSlugs(): Promise<string[]> {
  const { SA_PROVINCES, provinceToSlug } = await import('@/lib/procurement/provinces')
  const { isProvinceHubIndexable } = await import('./compulsoryBriefingHubs')
  const indexable: string[] = []
  for (const province of SA_PROVINCES) {
    const slug = provinceToSlug(province)
    const data = await loadProvinceHubData(province, slug)
    if (isProvinceHubIndexable(data.counts)) indexable.push(slug)
  }
  return indexable
}

/** Period slugs that have at least one briefing in range. */
export async function listIndexablePeriodHubSlugs(
  now: Date = new Date()
): Promise<BriefingPeriodSlug[]> {
  const { BRIEFING_PERIOD_SLUGS } = await import('./compulsoryBriefingPeriods')
  const { isPeriodHubIndexable } = await import('./compulsoryBriefingHubs')
  const indexable: BriefingPeriodSlug[] = []
  for (const period of BRIEFING_PERIOD_SLUGS) {
    const data = await loadPeriodHubData(period, now)
    if (isPeriodHubIndexable(data.tenders.length)) indexable.push(period)
  }
  return indexable
}

/** Province hub URL only when the hub meets the index threshold. */
export async function getIndexableProvinceHubHref(
  province?: string | null
): Promise<string | null> {
  if (!province?.trim()) return null
  const { PROVINCE_NAME_TO_SLUG, provinceFromSlug } = await import('@/lib/procurement/provinces')
  const { provinceHubPath, isProvinceHubIndexable } = await import('./compulsoryBriefingHubs')
  const slug = PROVINCE_NAME_TO_SLUG[province.trim()]
  if (!slug) return null
  const resolved = provinceFromSlug(slug)
  if (!resolved) return null
  const data = await loadProvinceHubData(resolved, slug)
  if (!isProvinceHubIndexable(data.counts)) return null
  return provinceHubPath(slug)
}
