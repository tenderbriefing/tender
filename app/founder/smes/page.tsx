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
import { ACCOUNT_SCOPE_OPTIONS, formatJoined, type AccountScope } from '@/lib/founder/dashboard'

export default function FounderSmesPage() {
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [accountScope, setAccountScope] = useState<AccountScope>('real')
  const debouncedQ = useDebouncedValue(q)
  const { loading, error, data, reload } = useFounderDashboard({
    view: 'smes',
    page,
    pageSize: 25,
    q: debouncedQ,
    accountScope,
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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <span className="font-medium text-slate-700">Accounts</span>
                <select
                  value={accountScope}
                  onChange={(e) => {
                    setPage(1)
                    setAccountScope(e.target.value as AccountScope)
                  }}
                  className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-brand-900 shadow-sm"
                >
                  {ACCOUNT_SCOPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-xs text-slate-500">
                Default excludes production smoke/certification accounts.
              </p>
            </div>
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
                            {row.isTestAccount ? (
                              <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                                Test
                              </span>
                            ) : null}
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
