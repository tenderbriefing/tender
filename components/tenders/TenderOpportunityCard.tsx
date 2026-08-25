'use client'

import Link from 'next/link'
import type { TenderBriefing } from '@/lib/tenderBriefing/types'
import { formatProcurementDate } from '@/lib/procurement/dates'
import { getTenderDisplayStatus } from '@/lib/procurement/tenderStatus'
import { isPrivateSectorTender } from '@/lib/privateTenders/publishMapper'
import StatusBadge from './StatusBadge'
import RequestAttendanceAction from './RequestAttendanceAction'

interface TenderOpportunityCardProps {
  tender: TenderBriefing
}

export default function TenderOpportunityCard({ tender }: TenderOpportunityCardProps) {
  const displayStatus = getTenderDisplayStatus(tender)
  const description = tender.summary || tender.description || ''
  const privateSector = isPrivateSectorTender(tender)

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-xs font-bold text-brand-800">
              {tender.tenderNumber || 'Tender'}
            </p>
            {privateSector && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700 ring-1 ring-inset ring-slate-200">
                Private Sector
              </span>
            )}
          </div>
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
          <dt className="font-medium text-slate-500">
            {privateSector ? 'Company' : 'Department'}
          </dt>
          <dd className="mt-0.5 line-clamp-2 font-medium text-slate-800">
            {tender.department || tender.buyer || '—'}
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

      <div className="mt-4 flex flex-col gap-2">
        <Link
          href={`/tenders/${tender.id}`}
          className="flex min-h-[44px] w-full items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
        >
          View Details
        </Link>
        <RequestAttendanceAction tender={tender} className="!w-full" />
      </div>
    </article>
  )
}
