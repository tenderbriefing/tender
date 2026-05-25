'use client'

import { useCallback, useEffect, useState } from 'react'
import { authFetch } from '@/lib/api/authenticatedFetch'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

export default function FraudOpsPanel() {
  const [alerts, setAlerts] = useState<Array<Record<string, unknown>>>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const res = await authFetch('/api/admin/fraud')
    const json = await res.json()
    if (json.success) setAlerts(json.data.alerts || [])
  }, [])

  useEffect(() => {
    load().finally(() => setLoading(false))
  }, [load])

  if (loading) return <LoadingSpinner />

  return (
    <div className="rounded-xl border bg-white shadow-sm">
      <div className="border-b px-6 py-4">
        <h3 className="font-semibold text-slate-900">Fraud alerts</h3>
        <p className="text-sm text-slate-500">GPS anomalies, duplicates, rapid movement</p>
      </div>
      <ul className="divide-y">
        {alerts.length === 0 && (
          <li className="px-6 py-8 text-center text-sm text-slate-500">No alerts</li>
        )}
        {alerts.map((a) => (
          <li key={String(a.id)} className="px-6 py-4 text-sm">
            <span className="font-semibold text-red-700">{String(a.alertType)}</span>
            <span className="text-slate-500"> · {String(a.severity)} · agent {String(a.agentId)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
