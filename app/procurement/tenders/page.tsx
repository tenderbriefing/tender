'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { authFetch } from '@/lib/api/authenticatedFetch'
import { PRIVATE_TENDER_STATUS_LABELS } from '@/lib/privateTenders/statusMachine'

const FILTERS = [
  { id: 'all', label: 'All', status: '' },
  { id: 'draft', label: 'Draft', status: 'draft' },
  { id: 'submitted', label: 'In Review', status: 'submitted' },
  { id: 'changes_requested', label: 'Changes Requested', status: 'changes_requested' },
  { id: 'published', label: 'Published', status: 'published' },
  { id: 'closed', label: 'Closed', status: 'closed' },
]

export default function ProcurementTendersPage() {
  const [filter, setFilter] = useState('all')
  const [tenders, setTenders] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      const res = await authFetch('/api/procurement/tenders')
      const json = await res.json()
      if (!res.ok) {
        setError(json?.error || 'Failed to load tenders')
        return
      }
      let rows = json.data.tenders || []
      if (filter === 'draft') rows = rows.filter((t: any) => t.status === 'draft')
      if (filter === 'submitted') {
        rows = rows.filter((t: any) =>
          ['submitted', 'under_review', 'approved'].includes(t.status)
        )
      }
      if (filter === 'changes_requested') {
        rows = rows.filter((t: any) => t.status === 'changes_requested')
      }
      if (filter === 'published') rows = rows.filter((t: any) => t.status === 'published')
      if (filter === 'closed') {
        rows = rows.filter((t: any) => ['closed', 'archived', 'withdrawn', 'rejected'].includes(t.status))
      }
      setTenders(rows)
    })()
  }, [filter])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-950">Tenders</h1>
          <p className="mt-1 text-sm text-slate-600">Organisation tender history.</p>
        </div>
        <Link
          href="/procurement/tenders/new"
          className="rounded-xl bg-brand-800 px-4 py-2.5 text-sm font-semibold text-white"
        >
          Create Tender
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              filter === f.id ? 'bg-brand-800 text-white' : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Closing</th>
              <th className="px-4 py-3">Updated</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {tenders.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  No tenders in this filter.
                </td>
              </tr>
            ) : (
              tenders.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium">{row.title || 'Untitled draft'}</td>
                  <td className="px-4 py-3 text-slate-600">{row.tenderReference || '—'}</td>
                  <td className="px-4 py-3">
                    {PRIVATE_TENDER_STATUS_LABELS[
                      row.status as keyof typeof PRIVATE_TENDER_STATUS_LABELS
                    ] || row.status}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{row.closingDate || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {row.updatedAt ? String(row.updatedAt).slice(0, 10) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/procurement/tenders/${row.id}`} className="font-semibold text-brand-800">
                      Open
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
