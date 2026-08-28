import Link from 'next/link'
import {
  formatProcurementDate,
  formatProcurementDateTime,
} from '@/lib/procurement/dates'
import { getOfficialEtendersScope } from '@/lib/procurement/tenderDescription'
import { getTenderDisplayStatus } from '@/lib/procurement/tenderStatus'
import type { TenderBriefing } from '@/lib/tenderBriefing/types'
import { showAgentBookingCta } from '@/lib/seo/compulsoryBriefingHubs'
import { resolveOrganisationFromTender } from '@/lib/seo/organisationRegistry'
import { organisationHubPath } from '@/lib/seo/organisationHubs'

function statusLabel(tender: TenderBriefing): string {
  const status = getTenderDisplayStatus(tender)
  if (status === 'closed') return 'Closed'
  if (status === 'compulsory_briefing') return 'Compulsory briefing'
  return 'Open'
}

export default function CompulsoryBriefingTenderList({
  tenders,
  heading,
  linkOrganisationHubs = false,
}: {
  tenders: TenderBriefing[]
  heading?: string
  /** When true, organisation names link to canonical org hubs if registered. */
  linkOrganisationHubs?: boolean
}) {
  if (tenders.length === 0) return null

  return (
    <section>
      {heading ? <h2 className="text-xl font-bold text-brand-900">{heading}</h2> : null}
      <ul className={`grid gap-4 md:grid-cols-2 ${heading ? 'mt-4' : ''}`}>
        {tenders.map((tender) => {
          const scope = getOfficialEtendersScope(tender) || tender.title
          const venue =
            tender.briefingVenue?.trim() ||
            (tender.meetingLink?.trim() ? 'Virtual briefing' : 'Venue TBC')
          const orgLabel = tender.department || tender.buyer || 'Organisation unavailable'
          const orgEntry = linkOrganisationHubs
            ? resolveOrganisationFromTender(tender)
            : null
          return (
            <li
              key={tender.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-800">
                  {statusLabel(tender)}
                </span>
                {tender.tenderNumber ? (
                  <span className="font-mono text-xs font-bold text-brand-800">
                    {tender.tenderNumber}
                  </span>
                ) : null}
              </div>
              <Link
                href={`/tenders/${tender.id}`}
                className="mt-2 block text-base font-semibold text-brand-900 hover:text-accent-700"
              >
                {scope}
              </Link>
              <p className="mt-2 text-sm text-slate-600">
                {orgEntry ? (
                  <Link
                    href={organisationHubPath(orgEntry.slug)}
                    className="font-medium text-brand-800 hover:underline"
                  >
                    {orgLabel}
                  </Link>
                ) : (
                  orgLabel
                )}
              </p>
              {tender.briefingDate ? (
                <p className="mt-2 text-sm font-medium text-accent-700">
                  Briefing: {formatProcurementDateTime(tender.briefingDate, tender.briefingTime)}
                </p>
              ) : null}
              <p className="mt-1 text-sm text-slate-600">Venue: {venue}</p>
              {tender.province ? (
                <p className="mt-1 text-sm text-slate-600">Province: {tender.province}</p>
              ) : null}
              {tender.closingDate ? (
                <p className="mt-1 text-sm text-slate-600">
                  Closing: {formatProcurementDate(tender.closingDate)}
                </p>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href={`/tenders/${tender.id}`}
                  className="text-sm font-semibold text-brand-800 hover:underline"
                >
                  View tender details →
                </Link>
                {showAgentBookingCta(tender) ? (
                  <Link
                    href={`/tenders/${tender.id}`}
                    className="text-sm font-semibold text-accent-700 hover:underline"
                  >
                    Book Youth Agent →
                  </Link>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
