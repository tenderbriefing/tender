'use client'

import { useCallback, useEffect, useState } from 'react'
import { authFetch } from '@/lib/api/authenticatedFetch'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

export default function AgentPerformanceOpsPanel() {
  const [ranked, setRanked] = useState<Array<Record<string, unknown>>>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const res = await authFetch('/api/admin/agents/performance')
    const json = await res.json()
    if (json.success) setRanked(json.data.ranked || [])
  }, [])

  useEffect(() => {
    load().finally(() => setLoading(false))
  }, [load])

  if (loading) return <LoadingSpinner />

  return (
    <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left">
          <tr>
            <th className="px-4 py-3">Agent</th>
            <th className="px-4 py-3">Tier</th>
            <th className="px-4 py-3">Score</th>
            <th className="px-4 py-3">Province</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {ranked.map((a) => (
            <tr key={String(a.agentId)}>
              <td className="px-4 py-3">{String(a.displayName || a.agentId)}</td>
              <td className="px-4 py-3">
                <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-800">
                  {String(a.tier)}
                </span>
              </td>
              <td className="px-4 py-3">{String(a.performanceScore)}</td>
              <td className="px-4 py-3">{String(a.province || '—')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
