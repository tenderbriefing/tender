import Link from 'next/link'
import { formatProcurementDateTime } from '@/lib/procurement/dates'
import { getOfficialEtendersScope } from '@/lib/procurement/tenderDescription'
import type { TenderBriefing } from '@/lib/tenderBriefing/types'

interface RelatedActiveTendersProps {
  currentTender: TenderBriefing
  activeTenders: TenderBriefing[]
}

export default function RelatedActiveTenders({
  currentTender,
  activeTenders,
}: RelatedActiveTendersProps) {
  const related = activeTenders
    .filter((t) => t.id !== currentTender.id)
    .filter((t) => {
      if (currentTender.province && t.province === currentTender.province) return true
      if (currentTender.category && t.category === currentTender.category) return true
      if (currentTender.department && t.department === currentTender.department) return true
      return false
    })
    .slice(0, 6)

  if (related.length === 0) return null

  return (
    <section aria-labelledby="related-active-tenders" className="mt-10">
      <h2
        id="related-active-tenders"
        className="text-lg font-bold text-brand-900"
      >
        Related active tenders
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Live compulsory briefing opportunities similar to this record.
      </p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {related.map((tender) => {
          const scope = getOfficialEtendersScope(tender)
          return (
            <li key={tender.id}>
              <Link
                href={`/tenders/${tender.id}`}
                className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-200 hover:shadow-md"
              >
                <p className="font-semibold text-brand-900 line-clamp-2">
                  {scope || tender.title || tender.tenderNumber}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {tender.department || tender.province || 'South Africa'}
                  {tender.briefingDate
                    ? ` · Briefing ${formatProcurementDateTime(tender.briefingDate, tender.briefingTime)}`
                    : ''}
                </p>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
