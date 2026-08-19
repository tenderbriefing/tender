'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FounderShell } from '@/components/founder/FounderShell'
import { FounderV2Gate } from '@/components/founder/v2/FounderV2Gate'
import { useDebouncedValue, useFounderDashboard } from '@/components/founder/v2/useFounderDashboard'
import {
  EmptyState,
  ErrorState,
  LifecycleBadge,
  LoadingState,
  Money,
  SearchPager,
} from '@/components/founder/v2/ui'
import { formatJoined } from '@/lib/founder/dashboard'

export default function FounderBriefingsPage() {
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const debouncedQ = useDebouncedValue(q)
  const { loading, error, data, reload } = useFounderDashboard({
    view: 'briefings',
    page,
    pageSize: 25,
    q: debouncedQ,
  })
  const table = data?.briefings

  return (
    <FounderV2Gate>
      <FounderShell title="Briefings" subtitle="Paid marketplace work — presentation lifecycle only">
        {loading && !table ? (
          <LoadingState label="Loading briefings…" />
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
              placeholder="Search SME, tender, agent…"
            />
            {!table?.items.length ? (
              <EmptyState title="No briefings in this view" />
            ) : (
              <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3">SME</th>
                        <th className="px-4 py-3">Tender</th>
                        <th className="hidden px-4 py-3 sm:table-cell">Briefing Date</th>
                        <th className="hidden px-4 py-3 text-right md:table-cell">Amount</th>
                        <th className="hidden px-4 py-3 lg:table-cell">Youth Agent</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {table.items.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-50/80">
                          <td className="px-4 py-3 font-medium text-brand-900">
                            <Link href={`/founder/briefings/${row.id}`} className="hover:underline">
                              {row.sme}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {row.tender}
                            <p className="mt-0.5 text-xs text-slate-400 sm:hidden">
                              {formatJoined(row.briefingDate)}
                            </p>
                          </td>
                          <td className="hidden px-4 py-3 tabular-nums text-slate-600 sm:table-cell">
                            {formatJoined(row.briefingDate)}
                          </td>
                          <td className="hidden px-4 py-3 text-right md:table-cell">
                            <Money cents={row.amountCents} />
                          </td>
                          <td className="hidden px-4 py-3 text-slate-600 lg:table-cell">
                            {row.youthAgent || '—'}
                          </td>
                          <td className="px-4 py-3">
                            <LifecycleBadge lifecycle={row.lifecycle} label={row.lifecycleLabel} />
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
