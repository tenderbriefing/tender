import type { Metadata } from 'next'
import {
  formatProcurementDate,
  formatProcurementDateTime,
  isBriefingPast,
  resolveBriefingDateTime,
  toSastIsoString,
} from '@/lib/procurement/dates'
import { getOfficialEtendersScope } from '@/lib/procurement/tenderDescription'
import { getTenderDisplayStatus } from '@/lib/procurement/tenderStatus'
import type { TenderBriefing } from '@/lib/tenderBriefing/types'
import { buildPageMetadata } from './metadata'
import { absoluteUrl, truncateMeta } from './site'

function procuringEntity(tender: TenderBriefing): string {
  return tender.department || tender.buyer || ''
}

export function buildTenderPageTitle(tender: TenderBriefing): string {
  const scope = getOfficialEtendersScope(tender)
  const titlePart = scope || tender.title || tender.tenderNumber || 'Tender opportunity'
  const org = procuringEntity(tender)
  const composed = org ? `${titlePart} | ${org}` : titlePart
  return truncateMeta(composed, 70)
}

export function buildTenderPageDescription(tender: TenderBriefing): string {
  const scope = getOfficialEtendersScope(tender)
  const org = procuringEntity(tender)
  const tenderRef = tender.tenderNumber ? `tender ${tender.tenderNumber}` : 'this opportunity'
  const isClosed = getTenderDisplayStatus(tender) === 'closed'

  const parts = [
    isClosed
      ? `Closed ${tenderRef}${org ? ` from ${org}` : ''}. Historical procurement record on TenderBriefing.`
      : `View ${tenderRef}${org ? ` from ${org}` : ''}, including closing date, briefing details, requirements and tender documents on TenderBriefing.`,
    scope && scope !== tender.title ? scope : '',
    tender.province ? `Province: ${tender.province}.` : '',
    tender.briefingDate && !isClosed
      ? `Compulsory briefing on ${formatProcurementDateTime(tender.briefingDate, tender.briefingTime)}.`
      : '',
    tender.closingDate ? `Closing ${formatProcurementDate(tender.closingDate)}.` : '',
  ].filter(Boolean)

  return truncateMeta(parts.join(' '))
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

/**
 * Event JSON-LD for the compulsory tender briefing / site meeting only — not the
 * procurement opportunity, publication date, or closing date.
 * Returns null when required briefing fields are insufficient.
 */
export function buildTenderBriefingEventJsonLd(tender: TenderBriefing): Record<string, unknown> | null {
  if (!tender.briefingCompulsory) return null
  if (!tender.briefingDate?.trim()) return null

  const startDate = toSastIsoString(
    resolveBriefingDateTime(tender.briefingDate, tender.briefingTime)
  )
  if (!startDate) return null

  const hasLocation = Boolean(
    tender.meetingLink?.trim() ||
      tender.briefingVenue?.trim() ||
      tender.province?.trim()
  )
  if (!hasLocation) return null

  const scope = getOfficialEtendersScope(tender)
  const isClosed = getTenderDisplayStatus(tender) === 'closed'
  const briefingPast = isBriefingPast(tender.briefingDate, tender.briefingTime)

  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: `Compulsory tender briefing — ${scope || tender.title || tender.tenderNumber || 'Site meeting'}`,
    description:
      tender.briefingVenue?.trim() ||
      scope ||
      tender.description ||
      'Compulsory tender briefing session',
    startDate,
    eventAttendanceMode: tender.meetingLink?.trim()
      ? 'https://schema.org/OnlineEventAttendanceMode'
      : 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus:
      isClosed || briefingPast
        ? 'https://schema.org/EventPast'
        : 'https://schema.org/EventScheduled',
    location: tender.meetingLink?.trim()
      ? {
          '@type': 'VirtualLocation',
          url: tender.meetingLink,
        }
      : {
          '@type': 'Place',
          name: tender.briefingVenue?.trim() || tender.province || 'South Africa',
          address: tender.briefingVenue?.trim() || tender.province || 'South Africa',
        },
    organizer: {
      '@type': 'Organization',
      name: procuringEntity(tender) || 'Government procuring entity',
    },
    url: absoluteUrl(`/tenders/${tender.id}`),
  }
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
        name: 'Tender opportunities',
        item: absoluteUrl('/tenders'),
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: truncateMeta(scope || tender.title || tender.tenderNumber, 80),
        item: absoluteUrl(`/tenders/${tender.id}`),
      },
    ],
  }
}
