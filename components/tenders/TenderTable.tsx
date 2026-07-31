'use client'

import Link from 'next/link'
import type { TenderBriefing } from '@/lib/tenderBriefing/types'
import { formatProcurementDate } from '@/lib/procurement/dates'
import { getTenderDisplayStatus } from '@/lib/procurement/tenderStatus'
import StatusBadge from './StatusBadge'
import RequestAttendanceAction from './RequestAttendanceAction'
import type { TenderSortKey } from '@/lib/procurement/filters'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface TenderTableProps {
  tenders: TenderBriefing[]
  sortKey: TenderSortKey
  sortDir: 'asc' | 'desc'
  onSort: (key: TenderSortKey) => void
}

function SortableHeader({
  label,
  column,
  sortKey,
  sortDir,
  onSort,
  className = '',
}: {
  label: string
  column: TenderSortKey
  sortKey: TenderSortKey
  sortDir: 'asc' | 'desc'
  onSort: (k: TenderSortKey) => void
  className?: string
}) {
  const active = sortKey === column
  return (
    <th scope="col" className={className}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className="inline-flex items-center gap-1 text-left text-xs font-bold uppercase tracking-wide text-slate-600 hover:text-brand-800"
      >
        {label}
        {active &&
          (sortDir === 'asc' ? (
            <ChevronUp className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" aria-hidden />
          ))}
      </button>
    </th>
  )
}

export default function TenderTable({ tenders, sortKey, sortDir, onSort }: TenderTableProps) {
  return (
    <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
      <table className="tender-opps-table w-full table-fixed" aria-label="Tender opportunities">
        <colgroup>
          <col className="w-[9%]" />
          <col className="w-[28%]" />
          <col className="w-[14%]" />
          <col className="w-[9%]" />
          <col className="w-[10%]" />
          <col className="w-[10%]" />
          <col className="w-[20%]" />
        </colgroup>
        <thead className="bg-gradient-to-r from-slate-50 to-brand-50/40">
          <tr>
            <SortableHeader
              label="Tender #"
              column="tenderNumber"
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
            />
            <th scope="col" className="px-3 py-3.5 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
              Description
            </th>
            <SortableHeader
              label="Department"
              column="department"
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
            />
            <SortableHeader
              label="Province"
              column="province"
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
            />
            <SortableHeader
              label="Closing"
              column="closingDate"
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
            />
            <th scope="col" className="px-2 py-3.5 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
              Status
            </th>
            <th scope="col" className="px-2 py-3.5 text-right text-xs font-bold uppercase tracking-wide text-slate-600">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {tenders.map((tender) => {
            const displayStatus = getTenderDisplayStatus(tender)
            const description = tender.summary || tender.description || tender.title
            return (
              <tr
                key={tender.id}
                className="group transition-colors hover:bg-brand-50/40"
              >
                <td className="px-3 py-4 align-top">
                  <span className="block truncate font-mono text-[11px] font-semibold text-slate-800">
                    {tender.tenderNumber || '—'}
                  </span>
                </td>
                <td className="px-3 py-4 align-top">
                  <p className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900 group-hover:text-brand-800">
                    {tender.title}
                  </p>
                  <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-500">
                    {description}
                  </p>
                </td>
                <td className="px-3 py-4 align-top">
                  <p className="line-clamp-3 text-xs leading-relaxed text-slate-700">
                    {tender.department || tender.buyer || '—'}
                  </p>
                </td>
                <td className="px-3 py-4 align-top">
                  <span className="inline-block max-w-full truncate rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                    {tender.province || '—'}
                  </span>
                </td>
                <td className="px-3 py-4 align-top">
                  <span className="text-xs font-semibold text-slate-800">
                    {formatProcurementDate(tender.closingDate)}
                  </span>
                </td>
                <td className="px-2 py-4 align-top">
                  <StatusBadge status={displayStatus} />
                </td>
                <td className="px-2 py-4 align-top text-right">
                  <div className="flex flex-col items-stretch gap-1.5 sm:items-end">
                    <Link
                      href={`/tenders/${tender.id}`}
                      className="inline-flex min-h-[36px] items-center justify-center whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      View Details
                    </Link>
                    <RequestAttendanceAction tender={tender} size="compact" />
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
