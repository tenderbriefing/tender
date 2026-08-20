import Link from 'next/link'
import { formatProcurementDateTime } from '@/lib/procurement/dates'
import { getOfficialEtendersScope } from '@/lib/procurement/tenderDescription'
import type { TenderBriefing } from '@/lib/tenderBriefing/types'

/** Crawlable tender links shared by programmatic browse SSR pages. */
export default function ProgrammaticTenderStaticList({ tenders }: { tenders: TenderBriefing[] }) {
  if (tenders.length === 0) return null

  return (
    <ul className="mt-8 grid gap-4 md:grid-cols-2" aria-label="Matching tender opportunities">
      {tenders.map((tender) => (
        <li
          key={tender.id}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <p className="font-mono text-xs font-bold text-brand-800">{tender.tenderNumber}</p>
          <Link
            href={`/tenders/${tender.id}`}
            className="mt-2 block text-base font-semibold text-brand-900 hover:text-accent-700"
          >
            {getOfficialEtendersScope(tender) || tender.title}
          </Link>
          <p className="mt-2 text-sm text-slate-600">{tender.department}</p>
          {tender.briefingDate ? (
            <p className="mt-3 text-sm font-medium text-accent-700">
              Briefing: {formatProcurementDateTime(tender.briefingDate, tender.briefingTime)}
            </p>
          ) : null}
          <Link
            href={`/tenders/${tender.id}`}
            className="mt-4 inline-flex text-sm font-semibold text-brand-800 hover:underline"
          >
            View tender details →
          </Link>
        </li>
      ))}
    </ul>
  )
}
