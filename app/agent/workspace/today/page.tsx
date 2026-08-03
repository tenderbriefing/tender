'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import WorkspaceShell from '@/components/agent/workspace/WorkspaceShell'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { workspaceMutate } from '@/lib/agent/workspace/clientApi'
import { Clock, MapPin, ChevronRight } from 'lucide-react'

type Board = {
  date: string
  todayAssignments: Array<Record<string, unknown>>
  todayOpportunities: Array<Record<string, unknown>>
  activeFieldWork: Array<Record<string, unknown>>
  summary: { todayCount: number; activeCount: number; opportunityCount: number }
}

function Card({ item }: { item: Record<string, unknown> }) {
  const id = String(item.requestId || '')
  return (
    <Link
      href={`/agent/workspace/assignments/${id}`}
      className="block rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:border-brand-200"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold text-slate-900">
            {String(item.tenderNumber || id)}
          </p>
          <p className="text-sm text-slate-600 line-clamp-2">
            {String(item.tenderTitle || 'Briefing assignment')}
          </p>
        </div>
        <ChevronRight className="h-5 w-5 text-slate-400" />
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
        <span className="flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5" />
          {String(item.province || '—')}
        </span>
        {Boolean(item.briefingTime || item.briefingDate) && (
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {String(item.briefingDate || '')} {String(item.briefingTime || '')}
          </span>
        )}
        <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 font-medium text-emerald-800">
          {String(item.status || '')}
        </span>
      </div>
    </Link>
  )
}

export default function WorkspaceTodayPage() {
  const [board, setBoard] = useState<Board | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await workspaceMutate<Board>('/api/agent/workspace', 'POST', {})
        if (!cancelled) setBoard(data)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <WorkspaceShell title="Today">
      {loading && (
        <div className="flex justify-center py-16">
          <LoadingSpinner />
        </div>
      )}
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}
      {board && (
        <div className="space-y-6">
          <section className="grid grid-cols-3 gap-2">
            {[
              { label: 'Today', value: board.summary.todayCount },
              { label: 'Active', value: board.summary.activeCount },
              { label: 'Open', value: board.summary.opportunityCount },
            ].map((k) => (
              <div
                key={k.label}
                className="rounded-xl border border-emerald-100 bg-white/90 px-3 py-3 text-center"
              >
                <p className="text-2xl font-bold text-slate-900">{k.value}</p>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  {k.label}
                </p>
              </div>
            ))}
          </section>

          <section>
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
              Active field work
            </h2>
            <div className="space-y-3">
              {board.activeFieldWork.length === 0 && (
                <p className="text-sm text-slate-500">No active assignments right now.</p>
              )}
              {board.activeFieldWork.map((item) => (
                <Card key={String(item.requestId)} item={item} />
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
              Today&apos;s briefings
            </h2>
            <div className="space-y-3">
              {[...board.todayAssignments, ...board.todayOpportunities].length === 0 && (
                <p className="text-sm text-slate-500">Nothing scheduled for {board.date}.</p>
              )}
              {[...board.todayAssignments, ...board.todayOpportunities].map((item) => (
                <Card key={String(item.requestId)} item={item} />
              ))}
            </div>
          </section>
        </div>
      )}
    </WorkspaceShell>
  )
}
