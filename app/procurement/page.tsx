'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { authFetch } from '@/lib/api/authenticatedFetch'
import { PRIVATE_TENDER_STATUS_LABELS } from '@/lib/privateTenders/statusMachine'

type Counts = {
  draft: number
  under_review: number
  changes_requested: number
  published: number
  closing_soon: number
  closed: number
}

type Row = {
  id: string
  title?: string
  tenderReference?: string
  status?: string
  closingDate?: string
  updatedAt?: string
}

export default function ProcurementDashboardPage() {
  const [counts, setCounts] = useState<Counts | null>(null)
  const [recent, setRecent] = useState<Row[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      const res = await authFetch('/api/procurement/dashboard')
      const json = await res.json()
      if (!res.ok) {
        setError(json?.error || 'Failed to load dashboard')
        return
      }
      setCounts(json.data.counts)
      setRecent(json.data.recent || [])
    })()
  }, [])

  const cards: { key: keyof Counts; label: string }[] = [
    { key: 'draft', label: 'Draft tenders' },
    { key: 'under_review', label: 'Under review' },
    { key: 'changes_requested', label: 'Changes requested' },
    { key: 'published', label: 'Published' },
    { key: 'closing_soon', label: 'Closing soon' },
    { key: 'closed', label: 'Closed' },
  ]

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-950">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-600">Organisation tender pipeline at a glance.</p>
        </div>
        <Link
          href="/procurement/tenders/new"
          className="rounded-xl bg-brand-800 px-4 py-2.5 text-sm font-semibold text-white"
        >
          Create Tender
        </Link>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <div key={card.key} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {card.label}
            </p>
            <p className="mt-2 text-2xl font-bold text-brand-950">
              {counts ? counts[card.key] : '—'}
            </p>
          </div>
        ))}
      </div>

      <section>
        <h2 className="text-lg font-semibold text-brand-950">Recent tenders</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
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
              {recent.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No tenders yet. Create your first draft.
                  </td>
                </tr>
              ) : (
                recent.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {row.title || 'Untitled draft'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{row.tenderReference || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                        {PRIVATE_TENDER_STATUS_LABELS[
                          row.status as keyof typeof PRIVATE_TENDER_STATUS_LABELS
                        ] || row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{row.closingDate || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {row.updatedAt ? row.updatedAt.slice(0, 10) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/procurement/tenders/${row.id}`}
                        className="font-semibold text-brand-800"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
