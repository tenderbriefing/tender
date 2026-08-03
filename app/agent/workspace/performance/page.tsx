'use client'

import { useEffect, useState } from 'react'
import WorkspaceShell from '@/components/agent/workspace/WorkspaceShell'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { workspaceGet } from '@/lib/agent/workspace/clientApi'

type Perf = {
  score: number
  tier: string
  factors: Array<{ key: string; label: string; contribution: number; detail: string }>
  attendancePct?: number
  missedBriefings?: number
  reliabilityScore?: number
  computedAt?: string
}

export default function WorkspacePerformancePage() {
  const [data, setData] = useState<Perf | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const d = await workspaceGet<Perf>('/api/agent/workspace/performance')
        if (!cancelled) setData(d)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <WorkspaceShell title="Performance">
      {!data && !error && (
        <div className="flex justify-center py-16">
          <LoadingSpinner />
        </div>
      )}
      {error && <p className="text-sm text-red-700">{error}</p>}
      {data && (
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 text-center">
            <p className="text-xs font-semibold uppercase text-brand-600">{data.tier}</p>
            <p className="mt-1 text-4xl font-bold text-slate-900">{data.score}</p>
            <p className="text-sm text-slate-500">Explainable composite score (0–100)</p>
            {data.attendancePct != null && (
              <p className="mt-2 text-xs text-slate-500">
                Attendance {data.attendancePct}% · missed {data.missedBriefings ?? 0}
              </p>
            )}
          </section>
          <section>
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
              Score factors
            </h2>
            <ul className="space-y-2">
              {data.factors.map((f) => (
                <li
                  key={f.key}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"
                >
                  <div className="flex justify-between gap-2">
                    <p className="font-semibold text-slate-900">{f.label}</p>
                    <p className="font-medium text-slate-700">
                      {f.contribution > 0 ? '+' : ''}
                      {f.contribution}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{f.detail}</p>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] text-slate-400">
              Factors use recorded field outcomes only — no invented metrics.
              {data.computedAt ? ` Computed ${data.computedAt.slice(0, 19)}.` : ''}
            </p>
          </section>
        </div>
      )}
    </WorkspaceShell>
  )
}
