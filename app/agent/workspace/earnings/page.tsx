'use client'

import { useEffect, useState } from 'react'
import WorkspaceShell from '@/components/agent/workspace/WorkspaceShell'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { workspaceGet } from '@/lib/agent/workspace/clientApi'

type MonthlyHistory = {
  periodKey: string
  eligibleJobCount: number
  grossEarningsCents: number
  status: string
  paidAt?: string | null
}

type EarningsData = {
  earnings: {
    completedBriefings: number
    pendingPayoutCents: number
    accruedCents?: number
    batchedCents?: number
    heldCents?: number
    paidEarningsCents: number
    currentMonthJobCount?: number
    currentMonthAccruedCents?: number
    monthEarningsCents: number
    monthlyHistory?: MonthlyHistory[]
    payouts?: Array<{
      payoutId: string
      requestId: string
      tenderId?: string
      payoutAmountCents: number
      status: string
      completedAt?: string | null
      eligibleAt?: string | null
      settledAt?: string | null
      settlementBatchId?: string | null
    }>
  }
  ledger: {
    balanceCents: number
    balanceZar: string
    entries: Array<Record<string, unknown>>
    currency: string
  }
}

function zar(cents: number) {
  return `R${(cents / 100).toFixed(2)}`
}

function formatPeriod(periodKey: string) {
  const [y, m] = periodKey.split('-')
  const date = new Date(Number(y), Number(m) - 1, 1)
  return date.toLocaleString(undefined, { month: 'long', year: 'numeric' })
}

function batchStatusLabel(status: string) {
  if (status === 'paid') return 'Paid via EFT'
  if (status === 'ready') return 'Ready for EFT'
  return status
}

export default function WorkspaceEarningsPage() {
  const [data, setData] = useState<EarningsData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const d = await workspaceGet<EarningsData>('/api/agent/workspace/earnings')
        if (!cancelled) setData(d)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const currentMonthLabel = formatPeriod(new Date().toISOString().slice(0, 7))

  return (
    <WorkspaceShell title="Earnings">
      {!data && !error && (
        <div className="flex justify-center py-16">
          <LoadingSpinner />
        </div>
      )}
      {error && <p className="text-sm text-red-700">{error}</p>}
      {data && (
        <div className="space-y-6">
          <section className="rounded-2xl border border-emerald-100 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
              This month · {currentMonthLabel}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Completed eligible jobs:{' '}
              <span className="font-semibold text-slate-900">
                {data.earnings.currentMonthJobCount ?? 0}
              </span>
            </p>
            <p className="mt-1 text-3xl font-bold text-slate-900">
              Accrued earnings: {zar(data.earnings.currentMonthAccruedCents ?? data.earnings.monthEarningsCents)}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Outstanding (accrued + batched): {zar(data.earnings.pendingPayoutCents)} · Settled{' '}
              {zar(data.earnings.paidEarningsCents)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              R200 per eligible briefing · settled monthly via EFT
            </p>
          </section>

          {data.earnings.monthlyHistory && data.earnings.monthlyHistory.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
                Earnings history
              </h2>
              <ul className="space-y-2">
                {data.earnings.monthlyHistory.map((m) => (
                  <li
                    key={m.periodKey}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"
                  >
                    <div>
                      <p className="font-medium text-slate-900">{formatPeriod(m.periodKey)}</p>
                      <p className="text-xs text-slate-500">
                        {m.eligibleJobCount} briefing{m.eligibleJobCount === 1 ? '' : 's'} ·{' '}
                        {batchStatusLabel(m.status)}
                      </p>
                    </div>
                    <p className="font-semibold text-emerald-700">
                      {zar(m.grossEarningsCents)}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {data.earnings.payouts && data.earnings.payouts.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
                Individual briefings
              </h2>
              <ul className="space-y-2">
                {data.earnings.payouts.map((p) => (
                  <li
                    key={p.payoutId}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"
                  >
                    <div>
                      <p className="font-medium text-slate-900">
                        Briefing {String(p.requestId).slice(0, 8)}…
                      </p>
                      <p className="text-xs text-slate-500 capitalize">
                        {p.status} · eligible {String(p.eligibleAt || '').slice(0, 10)}
                      </p>
                    </div>
                    <p className="font-semibold text-emerald-700">
                      {zar(p.payoutAmountCents)}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
              Ledger entries
            </h2>
            <ul className="space-y-2">
              {data.ledger.entries.map((e) => (
                <li
                  key={String(e.id)}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium text-slate-900">{String(e.description || e.type)}</p>
                    <p className="text-xs text-slate-500">
                      {String(e.type)} · {String(e.createdAt || '').slice(0, 10)}
                    </p>
                  </div>
                  <p
                    className={`font-semibold ${
                      Number(e.amountCents) >= 0 ? 'text-emerald-700' : 'text-red-700'
                    }`}
                  >
                    {zar(Number(e.amountCents) || 0)}
                  </p>
                </li>
              ))}
              {data.ledger.entries.length === 0 && (
                <p className="text-sm text-slate-500">No ledger entries yet.</p>
              )}
            </ul>
          </section>
        </div>
      )}
    </WorkspaceShell>
  )
}
