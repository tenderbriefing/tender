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

export default function FounderAgentsPage() {
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const debouncedQ = useDebouncedValue(q)
  const { loading, error, data, reload } = useFounderDashboard({
    view: 'agents',
    page,
    pageSize: 25,
    q: debouncedQ,
  })
  const table = data?.agents

  return (
    <FounderV2Gate>
      <FounderShell title="Youth Agents" subtitle="People attending briefings for SMEs">
        {loading && !table ? (
          <LoadingState label="Loading Youth Agents…" />
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
              placeholder="Search agent, province…"
            />
            {!table?.items.length ? (
              <EmptyState title="No Youth Agents in this view" />
            ) : (
              <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Agent</th>
                        <th className="hidden px-4 py-3 md:table-cell">Province</th>
                        <th className="hidden px-4 py-3 sm:table-cell">Joined</th>
                        <th className="px-4 py-3 text-right">Briefings</th>
                        <th className="px-4 py-3 text-right">Completed</th>
                        <th className="hidden px-4 py-3 text-right lg:table-cell">Reports</th>
                        <th className="hidden px-4 py-3 text-right xl:table-cell">Earnings</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {table.items.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-50/80">
                          <td className="px-4 py-3 font-medium text-brand-900">
                            <Link href={`/founder/agents/${row.id}`} className="hover:underline">
                              {row.agent}
                            </Link>
                            <p className="mt-0.5 text-xs text-slate-500 md:hidden">
                              {row.province || '—'}
                            </p>
                          </td>
                          <td className="hidden px-4 py-3 text-slate-600 md:table-cell">
                            {row.province || '—'}
                          </td>
                          <td className="hidden px-4 py-3 tabular-nums text-slate-600 sm:table-cell">
                            {formatJoined(row.joined)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">{row.briefings}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{row.completed}</td>
                          <td className="hidden px-4 py-3 text-right tabular-nums lg:table-cell">
                            {row.reports}
                          </td>
                          <td className="hidden px-4 py-3 text-right xl:table-cell">
                            <Money cents={row.earningsCents} />
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
