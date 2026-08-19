'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FounderShell } from '@/components/founder/FounderShell'
import { FounderV2Gate } from '@/components/founder/v2/FounderV2Gate'
import { useDebouncedValue, useFounderDashboard } from '@/components/founder/v2/useFounderDashboard'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  Money,
  SearchPager,
} from '@/components/founder/v2/ui'
import { formatJoined } from '@/lib/founder/dashboard'

export default function FounderSmesPage() {
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const debouncedQ = useDebouncedValue(q)
  const { loading, error, data, reload } = useFounderDashboard({
    view: 'smes',
    page,
    pageSize: 25,
    q: debouncedQ,
  })
  const table = data?.smes

  return (
    <FounderV2Gate>
      <FounderShell title="SMEs" subtitle="Registered businesses on TenderBriefing">
        {loading && !table ? (
          <LoadingState label="Loading SMEs…" />
        ) : error && !table ? (
          <ErrorState message={error} onRetry={reload} />
        ) : (
          <div className="space-y-4">
            <SearchPager
              q={q}
              onQuery={(v) => {
                setPage(1)
                setQ(v)
              }}
              page={table?.page || 1}
              totalPages={table?.totalPages || 1}
              onPage={setPage}
              placeholder="Search company, contact…"
            />
            {!table?.items.length ? (
              <EmptyState title="No SMEs in this view" />
            ) : (
              <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Company</th>
                        <th className="px-4 py-3">Contact</th>
                        <th className="hidden px-4 py-3 md:table-cell">Province</th>
                        <th className="hidden px-4 py-3 sm:table-cell">Joined</th>
                        <th className="px-4 py-3 text-right">Bookings</th>
                        <th className="hidden px-4 py-3 text-right lg:table-cell">Total Spent</th>
                        <th className="hidden px-4 py-3 xl:table-cell">Last Active</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {table.items.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-50/80">
                          <td className="px-4 py-3 font-medium text-brand-900">
                            <Link href={`/founder/smes/${row.id}`} className="hover:underline">
                              {row.company}
                            </Link>
                            <p className="mt-0.5 text-xs text-slate-500 md:hidden">{row.province || '—'}</p>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{row.contact}</td>
                          <td className="hidden px-4 py-3 text-slate-600 md:table-cell">
                            {row.province || '—'}
                          </td>
                          <td className="hidden px-4 py-3 tabular-nums text-slate-600 sm:table-cell">
                            {formatJoined(row.joined)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">{row.bookings}</td>
                          <td className="hidden px-4 py-3 text-right lg:table-cell">
                            <Money cents={row.totalSpentCents} />
                          </td>
                          <td className="hidden px-4 py-3 tabular-nums text-slate-600 xl:table-cell">
                            {formatJoined(row.lastActive)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </FounderShell>
    </FounderV2Gate>
  )
}
