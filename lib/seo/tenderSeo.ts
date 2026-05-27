import type { Metadata } from 'next'
import { formatProcurementDate, formatProcurementDateTime } from '@/lib/procurement/dates'
import { getOfficialEtendersScope } from '@/lib/procurement/tenderDescription'
import type { TenderBriefing } from '@/lib/tenderBriefing/types'
import { buildPageMetadata } from './metadata'
import { absoluteUrl, truncateMeta } from './site'

export function buildTenderPageTitle(tender: TenderBriefing): string {
  const scope = getOfficialEtendersScope(tender)
  const base = scope || tender.title || tender.tenderNumber || 'Tender opportunity'
  return truncateMeta(base, 70)
}

export function buildTenderPageDescription(tender: TenderBriefing): string {
  const scope = getOfficialEtendersScope(tender)
  const parts = [
    scope || tender.title,
    tender.department ? `Issued by ${tender.department}.` : '',
    tender.province ? `Province: ${tender.province}.` : '',
    tender.briefingDate
      ? `Compulsory briefing on ${formatProcurementDateTime(tender.briefingDate, tender.briefingTime)}.`
      : '',
    tender.closingDate ? `Closing ${formatProcurementDate(tender.closingDate)}.` : '',
    'View documents, briefing details and request a Youth Agent on TenderBriefing South Africa.',
  ].filter(Boolean)

  return truncateMeta(parts.join(' '))
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
      tender.province || 'South Africa tenders',
      tender.category || 'government tender',
      tender.department || 'procurement',
    ],
  })
}

export function buildTenderEventJsonLd(tender: TenderBriefing) {
  const scope = getOfficialEtendersScope(tender)
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: tender.briefingCompulsory
      ? `Compulsory tender briefing — ${scope || tender.title}`
      : `Tender briefing — ${scope || tender.title}`,
    description: scope || tender.description || tender.title,
    startDate: tender.briefingDate || undefined,
    eventAttendanceMode: tender.meetingLink
      ? 'https://schema.org/OnlineEventAttendanceMode'
      : 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    location: tender.meetingLink
      ? {
          '@type': 'VirtualLocation',
          url: tender.meetingLink,
        }
      : {
          '@type': 'Place',
          name: tender.briefingVenue || tender.province || 'South Africa',
          address: tender.briefingVenue || tender.province || 'South Africa',
        },
    organizer: {
      '@type': 'Organization',
      name: tender.department || tender.buyer || 'Government procuring entity',
    },
    url: absoluteUrl(`/tenders/${tender.id}`),
  }
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
