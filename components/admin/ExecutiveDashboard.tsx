'use client'

import { useCallback, useEffect, useState } from 'react'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { authFetch } from '@/lib/api/authenticatedFetch'
import { formatAttendanceFeeZar } from '@/lib/payments/attendanceFee'
import Link from 'next/link'

interface ExecutiveData {
  live?: {
    revenueTodayCents?: number
    paidRequests?: number
    pendingPaidRequests?: number
    conversionPct?: number
    whatsappSuccessRate?: number | null
    workflowCompletionRate?: number | null
    slaCompliancePct?: number | null
    averageDispatchMinutes?: number | null
    syncHealth?: string
    operationalUptime?: string
    provinceDemand?: Array<{ province: string; count: number }>
    topDepartments?: Array<{ department: string; count: number }>
    workflowHealth?: Record<string, number>
  }
}

interface InsightsData {
  highDemandProvinces?: Array<{ province: string; requestCount: number }>
  underServicedProvinces?: Array<{ province: string; gap: number }>
  highPerformingAgents?: Array<{ agentId: string; displayName?: string; tier: string; score: number }>
}

export default function ExecutiveDashboard() {
  const [exec, setExec] = useState<ExecutiveData['live'] | null>(null)
  const [insights, setInsights] = useState<InsightsData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const [eRes, iRes] = await Promise.all([
        authFetch('/api/admin/executive-analytics'),
        authFetch('/api/admin/procurement-insights'),
      ])
      const eJson = await eRes.json()
      const iJson = await iRes.json()
      if (eJson.success) setExec(eJson.data?.live || eJson.data)
      if (iJson.success) setInsights(iJson.data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 60000)
    return () => clearInterval(t)
  }, [load])

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  const e = exec || {}

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-3">
        <Link
          href="/admin/operations"
          className="text-sm font-medium text-brand-700 hover:underline"
        >
          ← Operations command center
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Widget title="Revenue today" value={formatAttendanceFeeZar(e.revenueTodayCents || 0)} />
        <Widget title="Paid requests" value={String(e.paidRequests ?? 0)} />
        <Widget
          title="WhatsApp delivery"
          value={e.whatsappSuccessRate != null ? `${e.whatsappSuccessRate}%` : '—'}
        />
        <Widget
          title="Dispatch success proxy"
          value={e.slaCompliancePct != null ? `${e.slaCompliancePct}% SLA` : '—'}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Widget title="Active workflows" value={String(e.pendingPaidRequests ?? 0)} sub="pending paid" />
        <Widget
          title="Workflow health"
          value={String(e.workflowCompletionRate ?? '—') + (e.workflowCompletionRate != null ? '%' : '')}
        />
        <Widget title="Operational uptime" value={e.operationalUptime || e.syncHealth || '—'} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Top provinces</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {(e.provinceDemand || []).slice(0, 8).map((p) => (
              <li key={p.province} className="flex justify-between">
                <span>{p.province}</span>
                <span className="font-semibold">{p.count}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Top departments</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {(e.topDepartments || []).slice(0, 8).map((d) => (
              <li key={d.department} className="flex justify-between">
                <span className="truncate pr-2">{d.department}</span>
                <span className="font-semibold">{d.count}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Predictive insights</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3 text-sm">
          <div>
            <h3 className="font-semibold text-slate-700">High demand</h3>
            <ul className="mt-2 space-y-1">
              {(insights?.highDemandProvinces || []).map((p) => (
                <li key={p.province}>
                  {p.province}: {p.requestCount} requests
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-slate-700">Under-serviced</h3>
            <ul className="mt-2 space-y-1">
              {(insights?.underServicedProvinces || []).map((p) => (
                <li key={p.province}>
                  {p.province}: gap {p.gap}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-slate-700">Top agents</h3>
            <ul className="mt-2 space-y-1">
              {(insights?.highPerformingAgents || []).map((a) => (
                <li key={a.agentId}>
                  {a.displayName || a.agentId} · {a.tier} ({a.score})
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-amber-100 bg-amber-50/50 p-4 text-sm text-slate-700">
        <p>
          <strong>Recent escalations:</strong> monitor pending paid requests over 15m / 60m in{' '}
          <Link href="/admin/operations" className="text-brand-700 underline">
            Operations
          </Link>
          . Average dispatch: {e.averageDispatchMinutes ?? '—'} minutes.
        </p>
      </section>
    </div>
  )
}

function Widget({
  title,
  value,
  sub,
}: {
  title: string
  value: string
  sub?: string
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-1 text-2xl font-bold text-brand-800">{value}</p>
      {sub ? <p className="text-xs text-slate-400">{sub}</p> : null}
    </div>
  )
}
