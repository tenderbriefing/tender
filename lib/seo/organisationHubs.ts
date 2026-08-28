import { BRIEFING_PRICE_LABEL } from '@/lib/domain/briefingPricing'
import type { OrganisationSeoEntry } from './organisationRegistry'

/** Index if totalPublic >= 4 OR (upcoming >= 2 AND totalPublic >= 3). */
export const ORG_HUB_MIN_TOTAL = 4
export const ORG_HUB_MIN_UPCOMING_PAIR = 2
export const ORG_HUB_MIN_TOTAL_WITH_UPCOMING = 3

/** Directory page requires at least this many indexable org hubs. */
export const ORG_DIRECTORY_MIN_INDEXABLE = 5

/** Max organisation chips on landing / directory nav. */
export const ORG_NAV_LINK_CAP = 12

export type OrganisationHubCounts = {
  upcoming: number
  historical: number
  totalPublic: number
}

export function isOrganisationHubIndexable(counts: OrganisationHubCounts): boolean {
  if (counts.totalPublic >= ORG_HUB_MIN_TOTAL) return true
  if (
    counts.upcoming >= ORG_HUB_MIN_UPCOMING_PAIR &&
    counts.totalPublic >= ORG_HUB_MIN_TOTAL_WITH_UPCOMING
  ) {
    return true
  }
  return false
}

export function organisationHubPath(slug: string): string {
  return `/tenders/organisations/${slug}/compulsory-briefings`
}

export function organisationDirectoryPath(): string {
  return '/tenders/organisations'
}

export function organisationHubTitle(entry: OrganisationSeoEntry): string {
  return `${entry.shortName} Tenders with Compulsory Briefings`
}

export function organisationHubDescription(entry: OrganisationSeoEntry): string {
  return `View ${entry.shortName} tenders with compulsory briefing requirements, including briefing dates, venues, tender references and closing dates.`
}

export function organisationHubIntro(entry: OrganisationSeoEntry): string {
  return `View current and recent ${entry.displayName} tenders with compulsory briefing requirements. Check briefing dates, venues, tender references and closing dates.`
}

export function organisationHubCtaCopy(): string {
  return `Need someone to attend a compulsory tender briefing? Book a TenderBriefing Youth Agent for ${BRIEFING_PRICE_LABEL}.`
}

export function organisationDirectoryTitle(): string {
  return 'Tenders by Organisation'
}

export function organisationDirectoryDescription(): string {
  return 'Browse organisations currently publishing tenders with compulsory briefing requirements on TenderBriefing.'
}
