import { BRIEFING_PRICE_LABEL } from '@/lib/domain/briefingPricing'
import type { SaProvince } from '@/lib/procurement/provinces'
import { PROVINCE_SLUG_TO_NAME, SA_PROVINCES, provinceToSlug } from '@/lib/procurement/provinces'
import type { TenderBriefing } from '@/lib/tenderBriefing/types'
import { resolveBriefingDateTime } from '@/lib/procurement/dates'
import type { BriefingPeriodSlug } from './compulsoryBriefingPeriods'
import { BRIEFING_PERIOD_LABELS } from './compulsoryBriefingPeriods'

/** Max upcoming compulsory briefings shown on a province hub. */
export const PROVINCE_HUB_UPCOMING_LIMIT = 50
/** Max recent closed/historical compulsory briefings on a province hub. */
export const PROVINCE_HUB_HISTORICAL_LIMIT = 20
/** Firestore scan budget for hub data loads. */
export const HUB_SCAN_BUDGET = 200
/** Max tenders collected per hub query page. */
export const HUB_PAGE_SIZE = 80
/** Max briefings on a time-period hub. */
export const PERIOD_HUB_LIMIT = 50

/** Minimum indexable compulsory records to allow index on a province hub. */
export const PROVINCE_HUB_MIN_INDEXABLE = 3

export type ProvinceHubCounts = {
  upcoming: number
  historical: number
  totalPublic: number
}

export function isProvinceHubIndexable(counts: ProvinceHubCounts): boolean {
  if (counts.totalPublic >= PROVINCE_HUB_MIN_INDEXABLE) return true
  if (counts.upcoming >= 1 && counts.totalPublic >= 2) return true
  return false
}

export function isPeriodHubIndexable(resultCount: number): boolean {
  return resultCount > 0
}

export function allProvinceSlugs(): string[] {
  return SA_PROVINCES.map((p) => provinceToSlug(p))
}

export function resolveProvinceSlug(slug: string): SaProvince | null {
  return PROVINCE_SLUG_TO_NAME[slug.trim().toLowerCase()] ?? null
}

export function provinceHubPath(slug: string): string {
  return `/tenders/${slug}/compulsory-briefings`
}

export function periodHubPath(period: BriefingPeriodSlug): string {
  return `/compulsory-tender-briefings/${period}`
}

export function provinceHubTitle(province: SaProvince): string {
  return `Compulsory Tender Briefings in ${province}`
}

export function provinceHubDescription(province: SaProvince): string {
  return `View compulsory tender briefings in ${province}, including tender references, briefing dates, venues, organisations and closing dates.`
}

export function periodHubTitle(period: BriefingPeriodSlug): string {
  if (period === 'today') return 'Compulsory Tender Briefings Today'
  if (period === 'this-week') return 'Compulsory Tender Briefings This Week'
  if (period === 'next-week') return 'Compulsory Tender Briefings Next Week'
  return 'Compulsory Tender Briefings This Month'
}

export function periodHubDescription(period: BriefingPeriodSlug): string {
  const label = BRIEFING_PERIOD_LABELS[period].toLowerCase()
  return `View compulsory tender briefings taking place ${label} across South Africa. Check tender references, briefing dates, venues and closing dates.`
}

export function provinceHubIntro(province: SaProvince): string {
  return `Find upcoming and recent tenders with compulsory briefings in ${province}. View briefing dates, venues, tender references, closing dates and appoint a TenderBriefing Youth Agent where attendance is eligible.`
}

export function periodHubIntro(period: BriefingPeriodSlug): string {
  const label = BRIEFING_PERIOD_LABELS[period].toLowerCase()
  return `View compulsory tender briefings taking place ${label} across South Africa, including briefing dates, venues, organisations, tender references and closing dates.`
}

export function provinceHubCtaCopy(): string {
  return `Need someone to attend a compulsory tender briefing? Book a TenderBriefing Youth Agent for ${BRIEFING_PRICE_LABEL}.`
}

export function compareBriefingDateAsc(a: TenderBriefing, b: TenderBriefing): number {
  const ia = resolveBriefingDateTime(a.briefingDate, a.briefingTime)
  const ib = resolveBriefingDateTime(b.briefingDate, b.briefingTime)
  if (ia && ib) {
    const diff = ia.getTime() - ib.getTime()
    if (diff !== 0) return diff
  } else if (ia && !ib) return -1
  else if (!ia && ib) return 1
  return (a.tenderNumber || a.id).localeCompare(b.tenderNumber || b.id)
}

export function compareBriefingDateDesc(a: TenderBriefing, b: TenderBriefing): number {
  return compareBriefingDateAsc(b, a)
}

export function isVirtualBriefing(tender: TenderBriefing): boolean {
  return Boolean(tender.meetingLink?.trim()) && !tender.briefingVenue?.trim()
}

export function showAgentBookingCta(tender: TenderBriefing): boolean {
  if (isVirtualBriefing(tender)) return false
  return tender.briefingCompulsory === true
}
