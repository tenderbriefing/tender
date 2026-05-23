'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { TenderBriefing } from '@/lib/tenderBriefing/types'
import { useAuth } from '@/components/providers/AuthProvider'
import {
  countdownLabel,
  formatProcurementDate,
  isClosingSoon,
} from '@/lib/procurement/dates'
import { BriefingSessionBlock, CompulsoryBriefingBadge } from './CompulsoryBriefingBadge'
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import type { TenderSortKey } from '@/lib/procurement/filters'

interface TenderOpportunitiesViewProps {
  tenders: TenderBriefing[]
  sortKey: TenderSortKey
  sortDir: 'asc' | 'desc'
  onSort: (key: TenderSortKey) => void
}

function SortHeader({
  label,
  column,
  sortKey,
  sortDir,
  onSort,
}: {
  label: string
  column: TenderSortKey
  sortKey: TenderSortKey
  sortDir: 'asc' | 'desc'
  onSort: (k: TenderSortKey) => void
}) {
  const active = sortKey === column
  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      className="inline-flex items-center gap-1 hover:text-brand-700"
    >
      {label}
      {active ? (
        sortDir === 'asc' ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )
      ) : null}
    </button>
  )
}

function ProvinceBadge({ province }: { province?: string }) {
  if (!province) return <span className="text-slate-400">—</span>
  return (
    <span className="inline-block rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700">
      {province}
    </span>
  )
}

function AttendanceActions({ tender }: { tender: TenderBriefing }) {
  const { user, userProfile } = useAuth()
  const router = useRouter()

  const requestHref = `/tenders/${tender.id}/request-agent`

  if (userProfile?.userType === 'sme') {
    return (
      <Link
        href={requestHref}
        className="inline-flex min-h-[40px] items-center justify-center rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700"
      >
        Request Attendance
      </Link>
    )
  }

  if (!user) {
    return (
      <button
        type="button"
        onClick={() => router.push('/auth/signin')}
        className="inline-flex min-h-[40px] items-center justify-center rounded-lg border border-brand-600 px-3 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-50"
      >
        Sign in to request
      </button>
    )
  }

  return (
    <Link
      href={`/tenders/${tender.id}`}
      className="inline-flex min-h-[40px] items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
    >
      View details
    </Link>
  )
}

export default function TenderOpportunitiesView({
  tenders,
  sortKey,
  sortDir,
  onSort,
}: TenderOpportunitiesViewProps) {
  return (
    <>
      {/* Desktop table */}
      <div className="hidden lg:block overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="procurement-table w-full min-w-[1100px]">
          <thead>
            <tr>
              <th>
                <SortHeader
                  label="Tender Number"
                  column="tenderNumber"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onSort}
                />
              </th>
              <th>Description</th>
              <th>
                <SortHeader
                  label="Department"
                  column="department"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onSort}
                />
              </th>
              <th>
                <SortHeader
                  label="Province"
                  column="province"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onSort}
                />
              </th>
              <th>Category</th>
              <th>
                <SortHeader
                  label="Closing Date"
                  column="closingDate"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onSort}
                />
              </th>
              <th>
                <SortHeader
                  label="Briefing Session"
                  column="briefingDate"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onSort}
                />
              </th>
              <th>Briefing</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tenders.map((tender) => (
              <tr key={tender.id} className="bg-white">
                <td className="font-mono text-xs font-semibold text-slate-900 whitespace-nowrap">
                  {tender.tenderNumber || '—'}
                </td>
                <td className="max-w-xs">
                  <Link
                    href={`/tenders/${tender.id}`}
                    className="font-medium text-brand-700 hover:text-brand-800 line-clamp-2"
                  >
                    {tender.title}
                  </Link>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                    {tender.summary || tender.description}
                  </p>
                </td>
                <td className="text-xs">{tender.department || '—'}</td>
                <td>
                  <ProvinceBadge province={tender.province} />
                </td>
                <td className="text-xs">{tender.industrySector || tender.category || '—'}</td>
                <td>
                  <div className="text-xs font-medium">{formatProcurementDate(tender.closingDate)}</div>
                  {isClosingSoon(tender.closingDate) && (
                    <span className="text-xs font-semibold text-red-600">Closing soon</span>
                  )}
                  {countdownLabel(tender.closingDate) && (
                    <div className="text-xs text-slate-500">{countdownLabel(tender.closingDate)} left</div>
                  )}
                </td>
                <td className="text-xs whitespace-nowrap">
                  {formatProcurementDate(tender.briefingDate)}
                  {tender.briefingTime ? ` · ${tender.briefingTime}` : ''}
                </td>
                <td>
                  {tender.briefingCompulsory ? (
                    <CompulsoryBriefingBadge pulse={false} />
                  ) : (
                    <span className="text-xs text-slate-500">Optional</span>
                  )}
                </td>
                <td className="text-right space-y-1">
                  <Link
                    href={`/tenders/${tender.id}`}
                    className="block text-xs font-semibold text-brand-700 hover:underline"
                  >
                    View Details
                  </Link>
                  <AttendanceActions tender={tender} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="lg:hidden space-y-4">
        {tenders.map((tender) => (
          <article
            key={tender.id}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-mono text-xs font-bold text-slate-800">
                  {tender.tenderNumber || 'Tender'}
                </p>
                <Link
                  href={`/tenders/${tender.id}`}
                  className="mt-1 text-base font-semibold text-brand-700"
                >
                  {tender.title}
                </Link>
              </div>
              <ProvinceBadge province={tender.province} />
            </div>
            <p className="mt-2 text-xs text-slate-600">{tender.department}</p>
            <div className="mt-3">
              <BriefingSessionBlock tender={tender} />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div>
                <dt className="text-slate-500">Closing Date</dt>
                <dd className="font-semibold text-slate-900">
                  {formatProcurementDate(tender.closingDate)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Category</dt>
                <dd className="font-medium">{tender.industrySector || '—'}</dd>
              </div>
            </dl>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Link
                href={`/tenders/${tender.id}`}
                className="flex-1 rounded-lg border border-slate-200 py-3 text-center text-sm font-semibold text-slate-800"
              >
                View Details
              </Link>
              <div className="flex-1">
                <AttendanceActions tender={tender} />
              </div>
            </div>
            {tender.detailUrl && (
              <a
                href={tender.detailUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-brand-700"
              >
                Official source <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </article>
        ))}
      </div>
    </>
  )
}
