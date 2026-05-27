'use client'

import { useCallback, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { TenderBriefing } from '@/lib/tenderBriefing/types'
import { useAuth } from '@/components/providers/AuthProvider'
import {
  countdownLabel,
  formatProcurementDate,
  formatProcurementDateTime,
  isBriefingThisWeek,
  isBriefingToday,
  isClosingSoon,
} from '@/lib/procurement/dates'
import { getOfficialEtendersScope } from '@/lib/procurement/tenderDescription'
import { BriefingSessionBlock, CompulsoryBriefingBadge } from './CompulsoryBriefingBadge'
import CountdownBadge from './CountdownBadge'
import { TENDER_TABLE_COLUMNS, type TenderColumnKey } from '@/lib/procurement/tableColumns'
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import type { TenderSortKey } from '@/lib/procurement/filters'

interface TenderOpportunitiesViewProps {
  tenders: TenderBriefing[]
  sortKey: TenderSortKey
  sortDir: 'asc' | 'desc'
  onSort: (key: TenderSortKey) => void
  visibleColumns: Set<TenderColumnKey>
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
      className="inline-flex items-center gap-1 rounded hover:text-brand-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      aria-label={`Sort by ${label}${active ? (sortDir === 'asc' ? ', ascending' : ', descending') : ''}`}
    >
      {label}
      {active ? (
        sortDir === 'asc' ? (
          <ChevronUp className="h-3 w-3" aria-hidden />
        ) : (
          <ChevronDown className="h-3 w-3" aria-hidden />
        )
      ) : null}
    </button>
  )
}

function rowHighlightClass(tender: TenderBriefing): string {
  const parts: string[] = []
  if (tender.briefingCompulsory) parts.push('procurement-row-compulsory')
  if (isClosingSoon(tender.closingDate)) parts.push('procurement-row-closing-soon')
  if (isBriefingThisWeek(tender.briefingDate)) parts.push('procurement-row-briefing-week')
  return parts.join(' ')
}

function AttendanceActions({ tender }: { tender: TenderBriefing }) {
  const { user, userProfile } = useAuth()
  const router = useRouter()
  const requestHref = `/tenders/${tender.id}/request-agent`

  if (userProfile?.userType === 'sme') {
    return (
      <Link
        href={requestHref}
        className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-brand-600 px-3 py-2.5 text-xs font-semibold text-white hover:bg-brand-700 sm:w-auto"
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
        className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg border border-brand-600 px-3 py-2.5 text-xs font-semibold text-brand-700 hover:bg-brand-50 sm:w-auto"
      >
        Sign in to request
      </button>
    )
  }

  return (
    <Link
      href={`/tenders/${tender.id}`}
      className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 sm:w-auto"
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
  visibleColumns,
}: TenderOpportunitiesViewProps) {
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([])
  const focusedIndex = useRef(0)

  const show = (key: TenderColumnKey) => visibleColumns.has(key)

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!['ArrowDown', 'ArrowUp', 'Enter'].includes(e.key)) return
      e.preventDefault()
      if (e.key === 'ArrowDown') {
        focusedIndex.current = Math.min(focusedIndex.current + 1, tenders.length - 1)
      } else if (e.key === 'ArrowUp') {
        focusedIndex.current = Math.max(focusedIndex.current - 1, 0)
      } else if (e.key === 'Enter') {
        const tender = tenders[focusedIndex.current]
        if (tender) window.location.href = `/tenders/${tender.id}`
        return
      }
      rowRefs.current[focusedIndex.current]?.focus()
    },
    [tenders]
  )

  useEffect(() => {
    focusedIndex.current = 0
  }, [tenders])

  return (
    <>
      <div
        className="procurement-table-wrap hidden lg:block"
        onKeyDown={handleKeyDown}
        role="region"
        aria-label="Tender opportunities table. Use arrow keys to navigate rows, Enter to open."
      >
        <table className="procurement-table w-full min-w-[960px]" aria-label="Tender opportunities">
          <thead>
            <tr>
              {show('tenderNumber') && (
                <th scope="col">
                  <SortHeader
                    label="Tender Number"
                    column="tenderNumber"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={onSort}
                  />
                </th>
              )}
              {show('description') && <th scope="col">Description</th>}
              {show('department') && (
                <th scope="col">
                  <SortHeader
                    label="Department"
                    column="department"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={onSort}
                  />
                </th>
              )}
              {show('province') && (
                <th scope="col">
                  <SortHeader
                    label="Province"
                    column="province"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={onSort}
                  />
                </th>
              )}
              {show('category') && <th scope="col">Category</th>}
              {show('briefingDate') && (
                <th scope="col">
                  <SortHeader
                    label="Briefing Date"
                    column="briefingDate"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={onSort}
                  />
                </th>
              )}
              {show('closingDate') && (
                <th scope="col">
                  <SortHeader
                    label="Closing Date"
                    column="closingDate"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={onSort}
                  />
                </th>
              )}
              {show('compulsory') && (
                <th scope="col" className="min-w-[140px]">
                  Compulsory Briefing
                </th>
              )}
              {show('actions') && (
                <th scope="col" className="text-right">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {tenders.map((tender, index) => (
              <tr
                key={tender.id}
                ref={(el) => {
                  rowRefs.current[index] = el
                }}
                tabIndex={0}
                className={`focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600 ${rowHighlightClass(tender)}`}
                aria-label={`${tender.tenderNumber || tender.title}${tender.briefingCompulsory ? ', compulsory briefing required' : ''}`}
              >
                {show('tenderNumber') && (
                  <td className="whitespace-nowrap font-mono text-xs font-semibold text-slate-900">
                    {tender.tenderNumber || '—'}
                  </td>
                )}
                {show('description') && (
                  <td className="max-w-xs">
                    <Link
                      href={`/tenders/${tender.id}`}
                      className="line-clamp-2 font-medium text-brand-700 hover:text-brand-800"
                    >
                      {tender.title}
                    </Link>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                      {getOfficialEtendersScope(tender) || tender.description || '—'}
                    </p>
                  </td>
                )}
                {show('department') && (
                  <td className="text-xs">{tender.department || '—'}</td>
                )}
                {show('province') && (
                  <td>
                    <span className="inline-block rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700">
                      {tender.province || '—'}
                    </span>
                  </td>
                )}
                {show('category') && (
                  <td className="text-xs">
                    {tender.industrySector || tender.category || '—'}
                  </td>
                )}
                {show('briefingDate') && (
                  <td className="whitespace-nowrap text-xs">
                    <div className="font-medium">
                      {formatProcurementDateTime(tender.briefingDate, tender.briefingTime)}
                    </div>
                    {isBriefingToday(tender.briefingDate) && (
                      <div className="mt-1">
                        <CountdownBadge targetDate={tender.briefingDate} variant="briefing" prefix="Today" />
                      </div>
                    )}
                    {isBriefingThisWeek(tender.briefingDate) && !isBriefingToday(tender.briefingDate) && (
                      <div className="mt-1">
                        <CountdownBadge targetDate={tender.briefingDate} variant="briefing" prefix="Briefing" />
                      </div>
                    )}
                  </td>
                )}
                {show('closingDate') && (
                  <td>
                    <div className="text-xs font-medium">
                      {formatProcurementDate(tender.closingDate)}
                    </div>
                    {isClosingSoon(tender.closingDate) && (
                      <CountdownBadge targetDate={tender.closingDate} variant="closing" prefix="Closes" />
                    )}
                  </td>
                )}
                {show('compulsory') && (
                  <td>
                    {tender.briefingCompulsory ? (
                      <CompulsoryBriefingBadge pulse />
                    ) : (
                      <span className="text-xs text-slate-500">Optional</span>
                    )}
                  </td>
                )}
                {show('actions') && (
                  <td className="text-right">
                    <Link
                      href={`/tenders/${tender.id}`}
                      className="text-xs font-medium text-brand-700 hover:underline"
                    >
                      View details
                    </Link>
                    <div className="mt-2 flex justify-end">
                      <AttendanceActions tender={tender} />
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-4 lg:hidden">
        {tenders.map((tender) => (
          <article
            key={tender.id}
            className={`rounded-xl border bg-white p-4 shadow-sm ${rowHighlightClass(tender) || 'border-slate-200'}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-mono text-xs font-bold text-slate-800">
                  {tender.tenderNumber || 'Tender'}
                </p>
                <Link
                  href={`/tenders/${tender.id}`}
                  className="mt-1 block text-base font-semibold text-brand-700"
                >
                  {tender.title}
                </Link>
              </div>
              {tender.briefingCompulsory && <CompulsoryBriefingBadge pulse />}
            </div>
            <p className="mt-2 text-xs text-slate-600">{tender.department}</p>
            <div className="mt-3">
              <BriefingSessionBlock tender={tender} />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div>
                <dt className="text-slate-500">Province</dt>
                <dd className="font-medium text-slate-900">{tender.province || '—'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Closing Date</dt>
                <dd className="font-semibold text-slate-900">
                  {formatProcurementDate(tender.closingDate)}
                  {isClosingSoon(tender.closingDate) && (
                    <span className="ml-1 text-red-700">· Closing soon</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Category</dt>
                <dd className="font-medium">{tender.industrySector || '—'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Briefing date & time</dt>
                <dd className="font-medium">
                  {formatProcurementDateTime(tender.briefingDate, tender.briefingTime)}
                  {countdownLabel(tender.briefingDate) && (
                    <span className="text-amber-800"> · {countdownLabel(tender.briefingDate)}</span>
                  )}
                </dd>
              </div>
            </dl>
            <div className="mt-4 flex flex-col gap-2">
              <Link
                href={`/tenders/${tender.id}`}
                className="min-h-[44px] rounded-lg border border-slate-200 py-3 text-center text-sm font-semibold text-slate-800"
              >
                View Details
              </Link>
              <AttendanceActions tender={tender} />
            </div>
            {tender.detailUrl && (
              <a
                href={tender.detailUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-brand-700"
              >
                Official source <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
            )}
          </article>
        ))}
      </div>
    </>
  )
}
