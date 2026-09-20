import type { Metadata } from 'next'
import {
  formatEventStartDate,
  formatProcurementDateTime,
  isBriefingPast,
  parseProcurementDate,
} from '@/lib/procurement/dates'
import { getOfficialEtendersScope } from '@/lib/procurement/tenderDescription'
import { getTenderDisplayStatus } from '@/lib/procurement/tenderStatus'
import type { TenderBriefing } from '@/lib/tenderBriefing/types'
import { buildPageMetadata } from './metadata'
import { DEFAULT_OG_IMAGE, SITE_NAME, absoluteUrl, truncateMeta } from './site'

/**
 * Intentional Google Event recommended-field omissions (accuracy > zero warnings):
 * - endDate: eTenders has no briefing end — never invent start+N hours
 * - organizer.url: no verified official org homepage on tender records
 * - performer: compulsory briefings have no performers
 * - offers: R349 is TenderBriefing Youth Agent attendance fee, NOT event admission
 *
 * image: reusable crawlable TenderBriefing brand OG (logo-class asset Google permits)
 * when no tender-specific briefing photo exists in the feed.
 */

function procuringEntity(tender: TenderBriefing): string {
  return tender.department || tender.buyer || ''
}

/** Human-readable SEO date — e.g. "28 August 2026". Returns empty when invalid. */
export function formatSeoVisibleDate(value?: string | null): string {
  const d = parseProcurementDate(value)
  if (!d) return ''
  return d.toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatSeoVisibleDateTime(date?: string | null, time?: string | null): string {
  const datePart = formatSeoVisibleDate(date)
  if (!datePart) return ''
  const full = formatProcurementDateTime(date, time)
  if (full === '—' || !full.includes(' at ')) return datePart
  const timePart = full.split(' at ').slice(1).join(' at ')
  return timePart ? `${datePart} at ${timePart}` : datePart
}

export function buildTenderPageTitle(tender: TenderBriefing): string {
  const ref = tender.tenderNumber?.trim()
  const shortTitle =
    getOfficialEtendersScope(tender) || tender.title?.trim() || 'Tender opportunity'

  if (ref) {
    const withTitle = `${ref} — ${shortTitle}`
    if (withTitle.length <= 58) return truncateMeta(withTitle, 65)
    if (tender.briefingCompulsory) {
      const compulsory = `${ref} — Compulsory Briefing Tender`
      if (compulsory.length <= 65) return compulsory
    }
    return truncateMeta(`${ref} — ${truncateMeta(shortTitle, 36)}`, 65)
  }

  if (tender.briefingCompulsory && shortTitle.length <= 45) {
    return truncateMeta(`${shortTitle} — Compulsory Briefing`, 65)
  }

  return truncateMeta(shortTitle, 65)
}

export function buildTenderPageDescription(tender: TenderBriefing): string {
  const org = procuringEntity(tender)
  const ref = tender.tenderNumber?.trim() || 'this tender'
  const isClosed = getTenderDisplayStatus(tender) === 'closed'

  if (isClosed) {
    const parts = [
      `Closed tender ${ref}`,
      org ? `from ${org}` : '',
      tender.briefingDate
        ? `Briefing was ${formatSeoVisibleDateTime(tender.briefingDate, tender.briefingTime)}`
        : '',
      tender.province ? `in ${tender.province}` : '',
      tender.closingDate ? `Closing ${formatSeoVisibleDate(tender.closingDate)}` : '',
      'Historical record on TenderBriefing',
    ].filter(Boolean)
    return truncateMeta(parts.join('. ').replace(/\.\s+\./g, '. '))
  }

  const segments = [`View ${ref}`, org ? `from ${org}` : ''].filter(Boolean)
  let description = segments.join(' ')

  if (tender.briefingCompulsory && tender.briefingDate) {
    const briefing = formatSeoVisibleDateTime(tender.briefingDate, tender.briefingTime)
    if (briefing) {
      description += `. Compulsory briefing ${briefing}`
      if (tender.province) description += ` in ${tender.province}`
    }
  } else if (tender.province) {
    description += `. Province: ${tender.province}`
  }

  if (tender.closingDate) {
    const closing = formatSeoVisibleDate(tender.closingDate)
    if (closing) description += `. Closing ${closing}`
  }

  description += '. View tender and briefing details on TenderBriefing.'
  return truncateMeta(description)
}

export function tenderHasUsefulHistoricalContent(tender: TenderBriefing): boolean {
  const scope = getOfficialEtendersScope(tender)
  return Boolean(
    scope ||
      tender.title ||
      tender.tenderNumber ||
      tender.description ||
      tender.summary ||
      tender.documents?.length
  )
}

export function buildTenderMetadata(tender: TenderBriefing): Metadata {
  const title = buildTenderPageTitle(tender)
  const description = buildTenderPageDescription(tender)

  return buildPageMetadata({
    title,
    description,
    path: `/tenders/${tender.id}`,
    keywords: [
      'tender briefing South Africa',
      'compulsory tender briefing',
      tender.sourceType === 'private' ? 'private sector tender' : 'government tender',
      tender.province || 'South Africa tenders',
      tender.category || (tender.sourceType === 'private' ? 'private tender' : 'government tender'),
      procuringEntity(tender) || 'procurement',
      tender.tenderNumber || '',
    ].filter(Boolean),
  })
}

function buildEventLocation(tender: TenderBriefing): Record<string, unknown> | null {
  const meetingLink = tender.meetingLink?.trim()
  if (meetingLink) {
    return {
      '@type': 'VirtualLocation',
      url: meetingLink,
    }
  }

  const venue = tender.briefingVenue?.trim()
  const province = tender.province?.trim()
  if (!venue && !province) return null

  const address: Record<string, string> = {
    '@type': 'PostalAddress',
    addressCountry: 'ZA',
  }
  if (province) address.addressRegion = province
  // Venue strings from eTenders are rarely clean street lines — keep as Place.name only.

  return {
    '@type': 'Place',
    name: venue || province || 'South Africa',
    address,
  }
}

function buildEventOrganizer(tender: TenderBriefing): Record<string, unknown> | null {
  const name = procuringEntity(tender).trim()
  if (!name) return null
  // organizer.url omitted: tender.detailUrl is the opportunity page (often eTenders),
  // not a verified official organisation homepage.
  return {
    '@type': 'Organization',
    name,
  }
}

function buildEventImage(): string[] {
  // Crawlable, public, absolute HTTPS brand asset (1200×630) — no tender photo in feed.
  return [absoluteUrl(DEFAULT_OG_IMAGE)]
}

/**
 * Canonical Event JSON-LD for the compulsory tender briefing / site meeting only —
 * not the procurement opportunity, publication date, closing date, or R349 service fee.
 * Returns null when required briefing fields are insufficient for Google Event markup.
 */
export function buildTenderBriefingEventJsonLd(tender: TenderBriefing): Record<string, unknown> | null {
  if (!tender.briefingCompulsory) return null
  if (!tender.briefingDate?.trim()) return null

  const startDate = formatEventStartDate(tender.briefingDate, tender.briefingTime)
  if (!startDate) return null

  const location = buildEventLocation(tender)
  if (!location) return null

  const scope = getOfficialEtendersScope(tender)
  const isClosed = getTenderDisplayStatus(tender) === 'closed'
  const briefingPast = isBriefingPast(tender.briefingDate, tender.briefingTime)
  const organizer = buildEventOrganizer(tender)

  const event: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: `Compulsory tender briefing — ${scope || tender.title || tender.tenderNumber || 'Site meeting'}`,
    description:
      tender.briefingVenue?.trim() ||
      scope ||
      tender.description ||
      'Compulsory tender briefing session',
    startDate,
    // endDate intentionally omitted — no reliable briefing end in source data
    eventAttendanceMode: tender.meetingLink?.trim()
      ? 'https://schema.org/OnlineEventAttendanceMode'
      : 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus:
      isClosed || briefingPast
        ? 'https://schema.org/EventPast'
        : 'https://schema.org/EventScheduled',
    location,
    image: buildEventImage(),
    url: absoluteUrl(`/tenders/${tender.id}`),
  }

  if (organizer) event.organizer = organizer

  // performer / offers intentionally omitted — see module header.

  return event
}

/** @deprecated Use buildTenderBriefingEventJsonLd — kept for transitional imports. */
export function buildTenderEventJsonLd(tender: TenderBriefing): Record<string, unknown> | null {
  return buildTenderBriefingEventJsonLd(tender)
}

export function buildTenderBreadcrumbJsonLd(tender: TenderBriefing) {
  const scope = getOfficialEtendersScope(tender)
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: absoluteUrl('/'),
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Tenders',
        item: absoluteUrl('/tenders'),
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: truncateMeta(
          tender.tenderNumber || scope || tender.title || 'Tender',
          80
        ),
        item: absoluteUrl(`/tenders/${tender.id}`),
      },
    ],
  }
}

export function buildTenderWebPageJsonLd(tender: TenderBriefing) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: buildTenderPageTitle(tender),
    description: buildTenderPageDescription(tender),
    url: absoluteUrl(`/tenders/${tender.id}`),
    inLanguage: 'en-ZA',
    isPartOf: {
      '@type': 'WebSite',
      name: SITE_NAME,
      url: absoluteUrl('/'),
    },
  }
}
