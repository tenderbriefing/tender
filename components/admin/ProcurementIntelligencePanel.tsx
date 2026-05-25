'use client'

import { useCallback, useEffect, useState } from 'react'
import { authFetch } from '@/lib/api/authenticatedFetch'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

type Dashboard = {
  sourceRegistry?: { total: number; enabled: number; sources: Array<Record<string, unknown>> }
  tendersBySource?: Record<string, number>
  briefingDensity?: { totalTenders: number; compulsoryBriefings: number; compulsoryRate: number }
  provinceHeatmap?: Array<{ province: string; count: number }>
  sectors?: Array<{ sector: string; count: number }>
  aiExtraction?: { averageBriefingConfidence: number | null; samples: Array<Record<string, unknown>> }
  sourceLogs?: Array<Record<string, unknown>>
  graphMetrics?: Record<string, unknown>
}

export default function ProcurementIntelligencePanel() {
  const [data, setData] = useState<Dashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)

  const load = useCallback(async () => {
    const res = await authFetch('/api/admin/procurement-intelligence')
    const json = await res.json()
    if (json.success) setData(json.data)
  }, [])

  useEffect(() => {
    load().finally(() => setLoading(false))
  }, [load])

  const runIngestion = async () => {
    setRunning(true)
    try {
      await authFetch('/api/admin/procurement-intelligence', {
        method: 'POST',
        body: JSON.stringify({ action: 'run_ingestion' }),
      })
      await load()
    } finally {
      setRunning(false)
    }
  }

  if (loading) return <LoadingSpinner />
  if (!data) return <p className="text-sm text-slate-600">Unable to load procurement intelligence.</p>

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={running}
          onClick={runIngestion}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {running ? 'Running…' : 'Run smart ingestion'}
        </button>
        <span className="text-sm text-slate-600 self-center">
          {data.sourceRegistry?.enabled} / {data.sourceRegistry?.total} sources enabled
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Tenders tracked</p>
          <p className="text-2xl font-bold">{data.briefingDensity?.totalTenders ?? 0}</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Compulsory briefings</p>
          <p className="text-2xl font-bold text-brand-700">
            {data.briefingDensity?.compulsoryBriefings ?? 0}
          </p>
          <p className="text-xs text-slate-500">{data.briefingDensity?.compulsoryRate}% rate</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">AI extraction confidence</p>
          <p className="text-2xl font-bold">
            {data.aiExtraction?.averageBriefingConfidence != null
              ? `${Math.round((data.aiExtraction.averageBriefingConfidence || 0) * 100)}%`
              : '—'}
          </p>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-6">
        <h3 className="font-semibold text-slate-900">Tenders by source</h3>
        <ul className="mt-3 space-y-1 text-sm">
          {Object.entries(data.tendersBySource || {}).map(([src, count]) => (
            <li key={src} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2">
              <span>{src}</span>
              <span className="font-semibold">{count}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-white p-6">
          <h3 className="font-semibold text-slate-900">Province heatmap</h3>
          <ul className="mt-3 space-y-1 text-sm">
            {(data.provinceHeatmap || []).slice(0, 10).map((p) => (
              <li key={p.province} className="flex justify-between">
                <span>{p.province}</span>
                <span>{p.count}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border bg-white p-6">
          <h3 className="font-semibold text-slate-900">Sectors</h3>
          <ul className="mt-3 space-y-1 text-sm">
            {(data.sectors || []).slice(0, 10).map((s) => (
              <li key={s.sector} className="flex justify-between">
                <span className="capitalize">{s.sector}</span>
                <span>{s.count}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-6">
        <h3 className="font-semibold text-slate-900">Source registry</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-2 pr-4">Source</th>
                <th className="py-2 pr-4">Type</th>
                <th className="py-2 pr-4">Tenders</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {(data.sourceRegistry?.sources || []).map((s) => (
                <tr key={String(s.id)} className="border-t border-slate-100">
                  <td className="py-2 pr-4 font-medium">{String(s.name)}</td>
                  <td className="py-2 pr-4">{String(s.type)}</td>
                  <td className="py-2 pr-4">{String(s.tenderCount ?? 0)}</td>
                  <td className="py-2">
                    {s.enabled ? (
                      <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs text-brand-800">
                        enabled
                      </span>
                    ) : (
                      <span className="text-slate-400">off</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-6">
        <h3 className="font-semibold text-slate-900">Recent source logs</h3>
        <ul className="mt-3 space-y-2 text-sm">
          {(data.sourceLogs || []).length === 0 ? (
            <li className="text-slate-500">No scrape logs yet</li>
          ) : (
            data.sourceLogs?.map((log) => (
              <li key={String(log.id)} className="rounded-lg bg-slate-50 px-3 py-2">
                {String(log.sourceId)} · {String(log.status)} · {String(log.records ?? 0)} records
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  )
}
