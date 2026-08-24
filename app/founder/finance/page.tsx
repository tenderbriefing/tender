'use client'

import { useCallback, useEffect, useState } from 'react'
import { FounderShell } from '@/components/founder/FounderShell'
import {
  ErrorState,
  KpiStrip,
  LoadingState,
  PeriodPicker,
} from '@/components/founder/v2/ui'
import {
  formatZarFromCents,
  periodLabel,
  type FounderDashboardPeriod,
} from '@/lib/founder/dashboard'
import { authFetch } from '@/lib/api/authenticatedFetch'

type FinancePayload = {
  period: string
  kpis: {
    bookingRevenueCents: number
    paidBookings: number
    agentPayoutsDueCents: number
    agentPayoutsHeldCents: number
    agentPayoutsPaidCents: number
    grossContributionCents: number
  }
  payouts: {
    items: Array<{
      payoutId: string
      youthAgentUid: string
      requestId: string
      tenderId: string
      payoutAmountCents: number
      status: string
      eligibilityStatus: string
      completedAt: string | null
      paidAt: string | null
      attendanceVerified: boolean
      evidenceSubmitted: boolean
    }>
    page: number
    pageSize: number
    total: number
  }
  notes: Record<string, string>
}

const STATUS_FILTERS = ['all', 'pending', 'eligible', 'held', 'paid', 'cancelled'] as const

export default function FounderFinancePage() {
  const [period, setPeriod] = useState<FounderDashboardPeriod>('30')
  const [status, setStatus] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<FinancePayload | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({ period, status, pageSize: '50' })
      const res = await authFetch(`/api/founder/finance?${qs}`)
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to load finance')
      setData(json.data as FinancePayload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [period, status])

  useEffect(() => {
    load()
  }, [load])

  async function patchPayout(payoutId: string, body: Record<string, unknown>) {
    setActionId(payoutId)
    try {
      const res = await authFetch(`/api/founder/payouts/${encodeURIComponent(payoutId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Action failed')
      await load()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setActionId(null)
    }
  }

  const kpis = data
    ? [
        {
          label: 'Booking Revenue',
          value: formatZarFromCents(data.kpis.bookingRevenueCents),
          hint: `${data.kpis.paidBookings} paid bookings`,
        },
        {
          label: 'Agent Payouts Due',
          value: formatZarFromCents(data.kpis.agentPayoutsDueCents),
          hint: 'Eligible, not yet paid',
        },
        {
          label: 'Agent Payouts Paid',
          value: formatZarFromCents(data.kpis.agentPayoutsPaidCents),
          hint: 'Settled liabilities',
        },
        {
          label: 'Gross Contribution',
          value: formatZarFromCents(data.kpis.grossContributionCents),
          hint: 'Revenue − payout liabilities',
        },
      ]
    : []

  return (
    <FounderShell
      title="Finance"
      subtitle={`Commercial ledger · ${periodLabel(period)}`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <PeriodPicker value={period} onChange={(v) => setPeriod(v as FounderDashboardPeriod)} />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="min-h-[36px] rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>
                {s === 'all' ? 'All statuses' : s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="min-h-[36px] rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-brand-800 disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
      }
    >
      {loading && !data ? (
        <LoadingState label="Loading finance…" />
      ) : error && !data ? (
        <ErrorState message={error} onRetry={load} />
      ) : data ? (
        <div className="space-y-8">
          <KpiStrip items={kpis} />
          {data.kpis.agentPayoutsHeldCents > 0 && (
            <p className="text-sm text-amber-800">
              Held payouts: {formatZarFromCents(data.kpis.agentPayoutsHeldCents)}
            </p>
          )}
          <section>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
              Youth Agent Payouts
            </h2>
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="min-w-full text-sm">
                <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Agent</th>
                    <th className="px-3 py-2">Request</th>
                    <th className="px-3 py-2">Completed</th>
                    <th className="px-3 py-2">Amount</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Evidence</th>
                    <th className="px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.payouts.items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                        No payouts in this filter.
                      </td>
                    </tr>
                  ) : (
                    data.payouts.items.map((p) => (
                      <tr key={p.payoutId} className="border-b border-slate-50">
                        <td className="px-3 py-2 font-mono text-xs">{p.youthAgentUid.slice(0, 8)}…</td>
                        <td className="px-3 py-2 font-mono text-xs">{p.requestId.slice(0, 10)}…</td>
                        <td className="px-3 py-2">{p.completedAt?.slice(0, 10) || '—'}</td>
                        <td className="px-3 py-2">{formatZarFromCents(p.payoutAmountCents)}</td>
                        <td className="px-3 py-2 capitalize">{p.status}</td>
                        <td className="px-3 py-2">
                          {p.attendanceVerified && p.evidenceSubmitted ? '✓' : '—'}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            {p.status === 'eligible' && (
                              <>
                                <button
                                  type="button"
                                  disabled={actionId === p.payoutId}
                                  className="rounded border px-2 py-1 text-xs"
                                  onClick={() =>
                                    patchPayout(p.payoutId, {
                                      action: 'hold',
                                      reason: 'Founder hold',
                                    })
                                  }
                                >
                                  Hold
                                </button>
                                <button
                                  type="button"
                                  disabled={actionId === p.payoutId}
                                  className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs"
                                  onClick={() => {
                                    const ref = window.prompt('Payment reference (required):')
                                    if (!ref) return
                                    patchPayout(p.payoutId, {
                                      action: 'mark_paid',
                                      paymentReference: ref,
                                      paymentMethod: 'manual',
                                    })
                                  }}
                                >
                                  Mark paid
                                </button>
                              </>
                            )}
                            {p.status === 'held' && (
                              <button
                                type="button"
                                disabled={actionId === p.payoutId}
                                className="rounded border px-2 py-1 text-xs"
                                onClick={() => patchPayout(p.payoutId, { action: 'release' })}
                              >
                                Release
                              </button>
                            )}
                            {p.status === 'paid' && (
                              <span className="text-xs text-slate-500">
                                {p.paidAt?.slice(0, 10) || 'Paid'}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
          <aside className="rounded-lg border border-slate-100 bg-slate-50 p-4 text-xs text-slate-600">
            <p className="font-semibold text-slate-700">Accounting notes</p>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              {Object.values(data.notes).map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </aside>
        </div>
      ) : (
        <ErrorState message="Finance data unavailable" onRetry={load} />
      )}
    </FounderShell>
  )
}
