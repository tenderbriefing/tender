'use client'

import { useCallback, useEffect, useState } from 'react'
import { authFetch } from '@/lib/api/authenticatedFetch'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

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

  return (
    <div className="space-y-6">
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
