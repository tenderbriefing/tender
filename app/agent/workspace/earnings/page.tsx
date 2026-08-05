'use client'

import { useEffect, useState } from 'react'
import WorkspaceShell from '@/components/agent/workspace/WorkspaceShell'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { workspaceGet } from '@/lib/agent/workspace/clientApi'

type EarningsData = {
  earnings: {
    completedBriefings: number
    pendingPayoutCents: number
    paidEarningsCents: number
    monthEarningsCents: number
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
              Ledger balance (ZAR)
            </p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{data.ledger.balanceZar}</p>
            <p className="mt-2 text-sm text-slate-600">
              Paid {zar(data.earnings.paidEarningsCents)} · Pending{' '}
              {zar(data.earnings.pendingPayoutCents)} · This month{' '}
              {zar(data.earnings.monthEarningsCents)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {data.earnings.completedBriefings} completed briefings · append-only ledger
            </p>
          </section>

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
