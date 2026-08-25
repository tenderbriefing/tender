'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { FounderShell } from '@/components/founder/FounderShell'
import { FounderV2Gate } from '@/components/founder/v2/FounderV2Gate'
import { EmptyState, ErrorState, LoadingState } from '@/components/founder/v2/ui'
import { authFetch } from '@/lib/api/authenticatedFetch'

type Row = {
  id: string
  status: string
  companyName: string
  title: string
  tenderReference: string
  closingDate: string
  briefingDate: string
  province: string
  municipality?: string
  submittedAt: string
  duplicateFlags?: string[]
  publishedTenderId?: string | null
}

export default function FounderPrivateTendersPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<Row[]>([])
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (status) params.set('status', status)
      if (q.trim()) params.set('q', q.trim())
      const res = await authFetch(`/api/founder/private-tenders?${params.toString()}`)
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to load')
      setItems(json.data?.items || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [status, q])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <FounderV2Gate>
      <FounderShell
        title="Private tenders"
        subtitle="Verify company submissions before publishing to the catalogue"
      >
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search company, title, reference…"
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm sm:max-w-xs"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-md border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            <option value="submitted">Submitted</option>
            <option value="under_review">Under review</option>
            <option value="changes_requested">Changes requested</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="published">Published</option>
          </select>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-md bg-brand-800 px-3 py-2 text-sm font-semibold text-white"
          >
            Refresh
          </button>
        </div>

        {loading && !items.length ? (
          <LoadingState label="Loading private tender submissions…" />
        ) : error && !items.length ? (
          <ErrorState message={error} onRetry={load} />
        ) : !items.length ? (
          <EmptyState title="No private tender submissions" />
        ) : (
          <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Company</th>
                    <th className="px-4 py-3">Tender</th>
                    <th className="hidden px-4 py-3 sm:table-cell">Closing</th>
                    <th className="hidden px-4 py-3 md:table-cell">Briefing</th>
                    <th className="hidden px-4 py-3 lg:table-cell">Location</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3 font-medium text-brand-900">
                        <Link href={`/founder/private-tenders/${row.id}`} className="hover:underline">
                          {row.companyName}
                        </Link>
                        {!!row.duplicateFlags?.length && (
                          <p className="mt-0.5 text-xs text-amber-700">Possible duplicate</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        <p className="font-medium">{row.title}</p>
                        <p className="text-xs text-slate-400">{row.tenderReference}</p>
                      </td>
                      <td className="hidden px-4 py-3 tabular-nums text-slate-600 sm:table-cell">
                        {row.closingDate || '—'}
                      </td>
                      <td className="hidden px-4 py-3 tabular-nums text-slate-600 md:table-cell">
                        {row.briefingDate || '—'}
                      </td>
                      <td className="hidden px-4 py-3 text-slate-600 lg:table-cell">
                        {row.municipality || row.province || '—'}
                      </td>
                      <td className="px-4 py-3 capitalize text-slate-700">
                        {String(row.status).replace(/_/g, ' ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </FounderShell>
    </FounderV2Gate>
  )
}
