'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { authFetch } from '@/lib/api/authenticatedFetch'
import { formatAttendanceFeeZar } from '@/lib/payments/attendanceFee'
import AiOpsExtension from '@/components/operations/AiOpsExtension'

interface CommandCenterData {
  generatedAt?: string
  dispatchBoard?: Array<{
    requestId: string
    tenderNumber?: string
    province?: string
    paidAt?: string
    notifiedCount?: number
    topAgents?: Array<{
      agentId: string
      displayName?: string
      dispatchScore: number
      tier?: string
      distanceKm?: number | null
    }>
  }>
  pendingQueue?: Array<{
    id: string
    tenderNumber?: string
    province?: string
    smeCompany?: string
    minutesWaiting?: number | null
    notifiedAgents?: number
  }>
  slaHeatmap?: Record<string, { normal: number; medium: number; high: number; critical: number }>
  whatsappStream?: Array<{ id: string; status?: string; type?: string; createdAt?: string }>
  whatsappSummary?: { configured?: boolean; sent?: number; failed?: number; pending?: number }
  paymentPipeline?: { pending: number; paid: number; failed: number; cancelled: number }
  workflowTimeline?: Array<{ id: string; type?: string; status?: string; startedAt?: string }>
  workflowFailed?: Array<{ id: string; type?: string; error?: string }>
  recentDispatches?: Array<{ id: string; type?: string; requestId?: string; createdAt?: string }>
  slaBreaches?: Array<{ id: string; breachType?: string; province?: string; minutesWaiting?: number }>
  executive?: {
    revenueTodayCents?: number
    paidRequests?: number
    conversionPct?: number
    whatsappSuccessRate?: number | null
    pendingPaidRequests?: number
  }
  agentTierCounts?: Record<string, number>
  activeAgentsMap?: Array<{
    id: string
    name?: string
    province?: string
    lat: number
    lng: number
    tier?: string
    availability?: string
  }>
  aiOps?: Record<string, unknown>
}

export default function CommandCenter() {
  const [data, setData] = useState<CommandCenterData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await authFetch('/api/admin/command-center')
      const json = await res.json()
      if (json.success) setData(json.data)
      else toast.error(json.error || 'Failed to load command center')
    } catch {
      toast.error('Command center unavailable')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [load])

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner />
      </div>
    )
  }

  if (!data) return null

  const exec = data.executive || {}
  const pay = data.paymentPipeline || { pending: 0, paid: 0, failed: 0, cancelled: 0 }
  const wa = data.whatsappSummary || {}

  return (
    <section className="space-y-6 rounded-xl border border-brand-200 bg-gradient-to-br from-slate-50 to-brand-50/30 p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Live command center</h2>
          <p className="text-sm text-slate-600">
            Real-time dispatch, SLA heatmap, payments, WhatsApp stream, workflow timeline
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label="Revenue today" value={formatAttendanceFeeZar(exec.revenueTodayCents || 0)} />
        <Kpi label="Paid requests" value={String(exec.paidRequests ?? 0)} />
        <Kpi label="Pending dispatch" value={String(exec.pendingPaidRequests ?? 0)} />
        <Kpi
          label="WhatsApp success"
          value={exec.whatsappSuccessRate != null ? `${exec.whatsappSuccessRate}%` : '—'}
          sub={wa.configured ? 'Twilio on' : 'Twilio off'}
        />
        <Kpi label="Conversion" value={`${exec.conversionPct ?? 0}%`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Live dispatch board">
          <div className="max-h-64 space-y-3 overflow-y-auto text-sm">
            {(data.dispatchBoard || []).map((row) => (
              <div key={row.requestId} className="rounded-lg border border-slate-100 bg-white p-3">
                <p className="font-semibold text-slate-900">
                  {row.tenderNumber || row.requestId}{' '}
                  <span className="text-slate-500">· {row.province}</span>
                </p>
                <p className="text-xs text-slate-500">
                  Notified: {row.notifiedCount ?? 0} agents
                </p>
                <ul className="mt-2 space-y-1">
                  {(row.topAgents || []).map((a) => (
                    <li key={a.agentId} className="flex justify-between text-xs">
                      <span>{a.displayName || a.agentId}</span>
                      <span className="font-mono text-brand-700">
                        {a.dispatchScore} · {a.tier}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {!data.dispatchBoard?.length && (
              <p className="text-slate-500">No paid pending requests in queue</p>
            )}
          </div>
        </Panel>

        <Panel title="Pending requests queue">
          <ul className="max-h-64 space-y-1 overflow-y-auto text-sm">
            {(data.pendingQueue || []).map((r) => (
              <li
                key={r.id}
                className="flex justify-between rounded border border-slate-100 bg-white px-2 py-1.5"
              >
                <span className="truncate">
                  {r.tenderNumber} · {r.smeCompany}
                </span>
                <span
                  className={
                    (r.minutesWaiting ?? 0) >= 60
                      ? 'text-red-700 font-semibold'
                      : (r.minutesWaiting ?? 0) >= 15
                        ? 'text-amber-700'
                        : 'text-slate-600'
                  }
                >
                  {r.minutesWaiting ?? '—'}m
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="SLA breach heatmap">
          <div className="space-y-2 text-xs">
            {Object.entries(data.slaHeatmap || {}).map(([province, buckets]) => (
              <div key={province} className="flex items-center gap-2">
                <span className="w-24 truncate font-medium">{province}</span>
                <HeatDot label="N" count={buckets.normal} color="bg-emerald-200" />
                <HeatDot label="15m" count={buckets.medium} color="bg-amber-200" />
                <HeatDot label="30m" count={buckets.high} color="bg-orange-300" />
                <HeatDot label="60m+" count={buckets.critical} color="bg-red-300" />
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Payment pipeline">
          <div className="grid grid-cols-2 gap-2 text-center text-sm">
            <Pipe label="Pending" value={pay.pending} />
            <Pipe label="Paid" value={pay.paid} tone="text-emerald-700" />
            <Pipe label="Failed" value={pay.failed} tone="text-red-700" />
            <Pipe label="Cancelled" value={pay.cancelled} />
          </div>
        </Panel>

        <Panel title="Agent tiers">
          <div className="grid grid-cols-2 gap-2 text-sm">
            {Object.entries(data.agentTierCounts || {}).map(([tier, count]) => (
              <div key={tier} className="rounded bg-white px-2 py-2 text-center border">
                <p className="font-bold">{count}</p>
                <p className="text-xs text-slate-600">{tier}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Map-ready agents: {data.activeAgentsMap?.length ?? 0}
          </p>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="WhatsApp delivery stream">
          <ul className="max-h-40 space-y-1 overflow-y-auto text-xs">
            {(data.whatsappStream || []).map((w) => (
              <li key={w.id} className="flex justify-between rounded bg-white px-2 py-1 border">
                <span className="capitalize">{w.status}</span>
                <span className="text-slate-500">{w.type}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-600">
            Sent {wa.sent} · Failed {wa.failed} · Pending {wa.pending}
          </p>
        </Panel>

        <Panel title="Workflow timeline">
          <ul className="max-h-40 space-y-1 overflow-y-auto text-xs">
            {(data.workflowTimeline || []).slice(0, 12).map((e) => (
              <li key={e.id} className="flex justify-between rounded bg-white px-2 py-1 border">
                <span>{e.type}</span>
                <span className="capitalize text-slate-600">{e.status}</span>
              </li>
            ))}
          </ul>
          {(data.workflowFailed?.length ?? 0) > 0 && (
            <p className="mt-2 text-xs font-semibold text-amber-800">
              {data.workflowFailed?.length} failed / retry workflow events
            </p>
          )}
        </Panel>
      </div>

      {(data.slaBreaches?.length ?? 0) > 0 && (
        <Panel title="SLA breaches & failed automation">
          <ul className="text-xs space-y-1">
            {data.slaBreaches?.slice(0, 8).map((b) => (
              <li key={b.id} className="text-red-800">
                {b.breachType} — {b.province} ({b.minutesWaiting}m) · {b.id}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <AiOpsExtension aiOps={data.aiOps as never} />
    </section>
  )
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-white bg-white/90 px-3 py-2 shadow-sm">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg font-bold text-slate-900">{value}</p>
      {sub ? <p className="text-xs text-slate-400">{sub}</p> : null}
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white/80 p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-800">{title}</h3>
      {children}
    </div>
  )
}

function HeatDot({
  label,
  count,
  color,
}: {
  label: string
  count: number
  color: string
}) {
  return (
    <span className={`inline-flex min-w-[2rem] justify-center rounded px-1 py-0.5 ${color}`}>
      {label}:{count}
    </span>
  )
}

function Pipe({
  label,
  value,
  tone = 'text-slate-800',
}: {
  label: string
  value: number
  tone?: string
}) {
  return (
    <div className="rounded border bg-white py-2">
      <p className={`text-xl font-bold ${tone}`}>{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  )
}
