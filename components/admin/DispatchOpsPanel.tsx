'use client'

import { useCallback, useEffect, useState } from 'react'
import { authFetch } from '@/lib/api/authenticatedFetch'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { MapPin, AlertCircle } from 'lucide-react'

type LiveAgent = {
  agentId: string
  lat: number
  lng: number
  lastPing?: string
}

export default function DispatchOpsPanel() {
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const res = await authFetch('/api/admin/dispatch')
    const json = await res.json()
    if (json.success) setData(json.data)
  }, [])

  useEffect(() => {
    load().finally(() => setLoading(false))
    const id = setInterval(load, 45000)
    return () => clearInterval(id)
  }, [load])

  if (loading) return <LoadingSpinner />
  if (!data) return null

  const active = (data.activeBriefings || []) as Array<Record<string, unknown>>
  const congestion = (data.dispatchCongestion || []) as Array<{
    province: string
    demand: number
    agents: number
    congestion: number
  }>
  const liveField = (data.liveFieldMap || {}) as {
    agents?: LiveAgent[]
    activeCheckIns?: Array<Record<string, unknown>>
    tracking?: Array<Record<string, unknown>>
  }
  const agents = liveField.agents || []
  const checkIns = liveField.activeCheckIns || []
  const tracking = liveField.tracking || []

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-brand-200 bg-brand-50/30 p-6">
        <h3 className="flex items-center gap-2 font-semibold text-slate-900">
          <MapPin className="h-5 w-5 text-brand-600" />
          Live field map — agent pings ({agents.length})
        </h3>
        <ul className="mt-4 max-h-64 space-y-2 overflow-y-auto text-sm">
          {agents.length === 0 ? (
            <li className="text-slate-500">No recent location pings</li>
          ) : (
            agents.map((a) => (
              <li key={a.agentId} className="flex justify-between rounded-lg bg-white px-3 py-2">
                <span className="font-mono text-xs">{a.agentId.slice(0, 12)}…</span>
                <span className="text-slate-600">
                  {a.lat?.toFixed(4)}, {a.lng?.toFixed(4)}
                </span>
                <span className="text-xs text-slate-400">{a.lastPing || '—'}</span>
              </li>
            ))
          )}
        </ul>
        <p className="mt-3 text-xs text-slate-500">
          Open coordinates in{' '}
          <a
            className="text-brand-700 underline"
            href="https://www.google.com/maps"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google Maps
          </a>{' '}
          for routing. Full map tiles require Maps API key.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-white p-6">
          <h3 className="font-semibold text-slate-900">Active check-ins ({checkIns.length})</h3>
          <ul className="mt-4 space-y-2 text-sm">
            {checkIns.slice(0, 15).map((c) => (
              <li key={String(c.id)} className="rounded-lg bg-slate-50 px-3 py-2">
                {String(c.requestId)} · agent {String(c.agentId || '').slice(0, 8)}…
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border bg-white p-6">
          <h3 className="flex items-center gap-2 font-semibold text-slate-900">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            Dispatch tracking ({tracking.length})
          </h3>
          <ul className="mt-4 space-y-2 text-sm">
            {tracking.slice(0, 12).map((t) => (
              <li key={String(t.id)} className="rounded-lg bg-slate-50 px-3 py-2">
                {String(t.requestId || t.status || '—')} · {String(t.province || '')}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-6">
        <h3 className="font-semibold text-slate-900">Active briefings ({active.length})</h3>
        <ul className="mt-4 space-y-2 text-sm">
          {active.slice(0, 12).map((b) => (
            <li key={String(b.requestId)} className="rounded-lg bg-slate-50 px-3 py-2">
              {String(b.tenderNumber)} · {String(b.province)} · {String(b.status)}
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-xl border bg-white p-6">
        <h3 className="font-semibold text-slate-900">Dispatch congestion by province</h3>
        <ul className="mt-4 space-y-2 text-sm">
          {congestion.map((c) => (
            <li key={c.province} className="flex justify-between">
              <span>{c.province}</span>
              <span className="text-slate-600">
                demand {c.demand} · agents {c.agents} · load {c.congestion}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
