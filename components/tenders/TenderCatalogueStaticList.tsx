import Link from 'next/link'
import type { TenderBriefing } from '@/lib/tenderBriefing/types'
import { formatProcurementDate, formatProcurementDateTime } from '@/lib/procurement/dates'
import { getOfficialEtendersScope } from '@/lib/procurement/tenderDescription'

interface TenderCatalogueStaticListProps {
  tenders: TenderBriefing[]
  id?: string
  heading?: string
}

/**
 * Server-rendered catalogue links for crawlers and no-JavaScript clients.
 * Matches the public catalogue's initial page — not filter permutations.
 */
export default function TenderCatalogueStaticList({
  tenders,
  id = 'tender-catalogue-ssr',
  heading = 'Live tender opportunities',
}: TenderCatalogueStaticListProps) {
  if (tenders.length === 0) {
    return (
      <section id={id} aria-labelledby={`${id}-heading`} className="mb-6">
        <h2 id={`${id}-heading`} className="text-lg font-bold text-brand-900">
          {heading}
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          No live compulsory briefing opportunities are loaded yet. Check back after the next
          official eTenders sync.
        </p>
      </section>
    )
  }

  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="mb-6">
      <h2 id={`${id}-heading`} className="sr-only">
        {heading}
      </h2>
      <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
        <table className="w-full table-fixed" aria-label={heading}>
          <thead className="bg-gradient-to-r from-slate-50 to-brand-50/40">
            <tr>
              <th scope="col" className="px-3 py-3.5 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
                Tender #
              </th>
              <th scope="col" className="px-3 py-3.5 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
                Description
              </th>
              <th scope="col" className="px-3 py-3.5 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
                Department
              </th>
              <th scope="col" className="px-3 py-3.5 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
                Province
              </th>
              <th scope="col" className="px-3 py-3.5 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
                Briefing
              </th>
              <th scope="col" className="px-3 py-3.5 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
                Closing
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tenders.map((tender) => {
              const scope = getOfficialEtendersScope(tender)
              return (
                <tr key={tender.id} className="hover:bg-brand-50/30">
                  <td className="px-3 py-3 font-mono text-xs font-semibold text-brand-800">
                    {tender.tenderNumber || '—'}
                  </td>
                  <td className="px-3 py-3">
                    <Link
                      href={`/tenders/${tender.id}`}
                      className="text-sm font-semibold text-brand-900 hover:text-accent-700 line-clamp-2"
                    >
                      {scope || tender.title || tender.tenderNumber || 'View tender'}
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-sm text-slate-600">{tender.department || '—'}</td>
                  <td className="px-3 py-3 text-sm text-slate-600">{tender.province || '—'}</td>
                  <td className="px-3 py-3 text-sm text-slate-600">
                    {tender.briefingDate
                      ? formatProcurementDateTime(tender.briefingDate, tender.briefingTime)
                      : '—'}
                  </td>
                  <td className="px-3 py-3 text-sm text-slate-600">
                    {formatProcurementDate(tender.closingDate)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <ul className="mt-4 space-y-4 md:hidden" aria-label={`${heading} — mobile list`}>
        {tenders.map((tender) => {
          const scope = getOfficialEtendersScope(tender)
          return (
            <li
              key={tender.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <p className="font-mono text-xs font-bold text-brand-800">
                {tender.tenderNumber || 'Tender'}
              </p>
              <Link
                href={`/tenders/${tender.id}`}
                className="mt-2 block text-base font-semibold text-brand-900 hover:text-accent-700"
              >
                {scope || tender.title || 'View tender details'}
              </Link>
              <p className="mt-2 text-sm text-slate-600">{tender.department || tender.province}</p>
              {tender.briefingDate ? (
                <p className="mt-2 text-sm font-medium text-accent-700">
                  Briefing: {formatProcurementDateTime(tender.briefingDate, tender.briefingTime)}
                </p>
              ) : null}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
