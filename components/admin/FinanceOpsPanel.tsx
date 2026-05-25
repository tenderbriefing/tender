'use client'

import { useCallback, useEffect, useState } from 'react'
import { authFetch } from '@/lib/api/authenticatedFetch'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

export default function FinanceOpsPanel() {
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const res = await authFetch('/api/admin/finance')
    const json = await res.json()
    if (json.success) setData(json.data)
  }, [])

  useEffect(() => {
    load().finally(() => setLoading(false))
  }, [load])

  if (loading) return <LoadingSpinner />
  if (!data) return <p className="text-slate-500">No finance data</p>

  const commission = data.commission as Record<string, number> | undefined
  const recon = data.reconciliation as Record<string, unknown> | undefined

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Gross revenue (paid)</p>
          <p className="text-2xl font-bold text-brand-700">
            R{((commission?.grossCents || 0) / 100).toFixed(2)}
          </p>
        </div>
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Platform commission</p>
          <p className="text-2xl font-bold text-slate-900">
            R{((commission?.platformCommissionCents || 0) / 100).toFixed(2)}
          </p>
        </div>
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Agent pool</p>
          <p className="text-2xl font-bold text-slate-900">
            R{((commission?.agentPoolCents || 0) / 100).toFixed(2)}
          </p>
        </div>
      </div>
      <div className="rounded-xl border bg-white p-6">
        <h3 className="font-semibold text-slate-900">Reconciliation</h3>
        <pre className="mt-3 overflow-auto text-xs text-slate-600">
          {JSON.stringify(recon, null, 2)}
        </pre>
      </div>
    </div>
  )
}
