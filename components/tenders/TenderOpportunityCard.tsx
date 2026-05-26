'use client'

import Link from 'next/link'
import type { TenderBriefing } from '@/lib/tenderBriefing/types'
import { formatProcurementDate } from '@/lib/procurement/dates'
import { getTenderDisplayStatus } from '@/lib/procurement/tenderStatus'
import StatusBadge from './StatusBadge'

interface TenderOpportunityCardProps {
  tender: TenderBriefing
}

export default function TenderOpportunityCard({ tender }: TenderOpportunityCardProps) {
  const displayStatus = getTenderDisplayStatus(tender)
  const description = tender.summary || tender.description || ''

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs font-bold text-emerald-800">
            {tender.tenderNumber || 'Tender'}
          </p>
          <h3 className="mt-1 line-clamp-2 text-base font-semibold leading-snug text-slate-900">
            {tender.title}
          </h3>
        </div>
        <StatusBadge status={displayStatus} />
      </div>

      {description && (
        <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-slate-600">{description}</p>
      )}

      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div>
          <dt className="font-medium text-slate-500">Department</dt>
          <dd className="mt-0.5 line-clamp-2 font-medium text-slate-800">
            {tender.department || '—'}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-slate-500">Province</dt>
          <dd className="mt-0.5 font-medium text-slate-800">{tender.province || '—'}</dd>
        </div>
        <div className="col-span-2">
          <dt className="font-medium text-slate-500">Closing date</dt>
          <dd className="mt-0.5 font-semibold text-slate-900">
            {formatProcurementDate(tender.closingDate)}
          </dd>
        </div>
      </dl>

      <Link
        href={`/tenders/${tender.id}`}
        className="mt-4 flex min-h-[44px] w-full items-center justify-center rounded-xl bg-emerald-600 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
      >
        View Details
      </Link>
    </article>
  )
}
