'use client'

import { useCallback, useEffect, useState } from 'react'
import { authFetch } from '@/lib/api/authenticatedFetch'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

export default function AiInsightsPanel() {
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const res = await authFetch('/api/admin/ai-insights')
    const json = await res.json()
    if (json.success) setData(json.data)
  }, [])

  useEffect(() => {
    load().finally(() => setLoading(false))
  }, [load])

  if (loading) return <LoadingSpinner />
  if (!data) return null

  const trends = (data.opportunityTrends || []) as Array<Record<string, number | string>>

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-white p-6">
        <h3 className="font-semibold text-slate-900">Opportunity trends (urgency)</h3>
        <ul className="mt-4 space-y-2 text-sm">
          {trends.map((t) => (
            <li key={String(t.tenderId)} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2">
              <span>{String(t.tenderId)}</span>
              <span>
                urgency {String(t.urgencyScore)} · fit {String(t.smeSuitabilityScore)}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-xl border bg-brand-50/50 p-6 text-sm text-slate-700">
        <p className="font-semibold text-slate-900">Pricing intelligence sample</p>
        <pre className="mt-2 overflow-auto text-xs">
          {JSON.stringify(
            (data.aiInsights as { pricingSample?: unknown })?.pricingSample,
            null,
            2
          )}
        </pre>
      </div>
    </div>
  )
}
