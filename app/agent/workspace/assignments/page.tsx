'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import WorkspaceShell from '@/components/agent/workspace/WorkspaceShell'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { workspaceGet } from '@/lib/agent/workspace/clientApi'
import { ChevronRight, MapPin } from 'lucide-react'

type Item = Record<string, unknown>

export default function WorkspaceAssignmentsPage() {
  const [data, setData] = useState<{ assignments: Item[]; opportunities: Item[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'mine' | 'open'>('mine')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const d = await workspaceGet<{ assignments: Item[]; opportunities: Item[] }>(
          '/api/agent/workspace/assignments'
        )
        if (!cancelled) setData(d)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const list = tab === 'mine' ? data?.assignments || [] : data?.opportunities || []

  return (
    <WorkspaceShell title="Assignments">
      <div className="mb-4 flex gap-2">
        {(
          [
            ['mine', 'My assignments'],
            ['open', 'Opportunities'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`min-h-[40px] flex-1 rounded-lg text-sm font-semibold ${
              tab === key ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {!data && !error && (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      )}
      {error && <p className="text-sm text-red-700">{error}</p>}
      <div className="space-y-3">
        {list.map((item) => {
          const id = String(item.requestId)
          return (
            <Link
              key={id}
              href={`/agent/workspace/assignments/${id}`}
              className="flex items-start justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-4"
            >
              <div>
                <p className="font-bold text-slate-900">{String(item.tenderNumber || id)}</p>
                <p className="text-sm text-slate-600 line-clamp-2">
                  {String(item.tenderTitle || '')}
                </p>
                <p className="mt-2 flex items-center gap-1 text-xs text-slate-500">
                  <MapPin className="h-3.5 w-3.5" />
                  {String(item.province || '—')} · {String(item.status || '')}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-slate-400" />
            </Link>
          )
        })}
        {data && list.length === 0 && (
          <p className="text-sm text-slate-500">No items in this list.</p>
        )}
      </div>
    </WorkspaceShell>
  )
}
