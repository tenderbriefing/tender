'use client'

import { Fragment, useCallback, useEffect, useState } from 'react'
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

type MonthlyBatch = {
  batchId: string
  youthAgentUid: string
  periodKey: string
  eligibleJobCount: number
  grossEarningsCents: number
  status: string
  operationalStatus?: string
  operationalStatusLabel?: string
  bankingDetailsPresent?: boolean
  paidAt?: string | null
  paymentReference?: string | null
  bankSummary?: {
    bankName?: string
    accountHolderName?: string
    accountNumberMasked?: string
  } | null
}

type FinancePayload = {
  period: string
  batchPeriodKey?: string | null
  kpis: {
    bookingRevenueCents: number
    paidBookings: number
    yaEarningsAccruedCents: number
    yaBatchedAwaitingEftCents: number
    yaPayoutsSettledCents: number
    outstandingYaLiabilityCents: number
    agentPayoutsHeldCents: number
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
      eligibleAt: string | null
      settledAt: string | null
      settlementBatchId?: string | null
      attendanceVerified: boolean
      evidenceSubmitted: boolean
    }>
    page: number
    pageSize: number
    total: number
  }
  monthlyBatches: { items: MonthlyBatch[] }
  notes: Record<string, string>
}

const JOB_STATUS_FILTERS = [
  'all',
  'pending',
  'eligible',
  'held',
  'batched',
  'settled',
  'paid',
  'cancelled',
] as const

const BATCH_STATUS_FILTERS = ['all', 'ready', 'paid', 'cancelled'] as const

function currentPeriodKey() {
  return new Date().toISOString().slice(0, 7)
}

export default function FounderFinancePage() {
  const [period, setPeriod] = useState<FounderDashboardPeriod>('30')
  const [status, setStatus] = useState<string>('all')
  const [batchPeriodKey, setBatchPeriodKey] = useState(currentPeriodKey())
  const [batchStatus, setBatchStatus] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<FinancePayload | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null)
  const [batchDetail, setBatchDetail] = useState<Record<string, unknown> | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({
        period,
        status,
        pageSize: '50',
        batchPeriodKey,
        batchStatus,
      })
      const res = await authFetch(`/api/founder/finance?${qs}`)
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to load finance')
      setData(json.data as FinancePayload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [period, status, batchPeriodKey, batchStatus])

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

  async function generateMonthlyBatches() {
    setActionId('generate')
    try {
      const res = await authFetch('/api/founder/payout-batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodKey: batchPeriodKey }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Generation failed')
      await load()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setActionId(null)
    }
  }

  async function markBatchPaid(batchId: string, expectedCents: number) {
    const ref = window.prompt('EFT / payment reference (required):')
    if (!ref) return
    const amountZar = window.prompt(
      `Amount paid in ZAR (must equal ${formatZarFromCents(expectedCents)}):`,
      (expectedCents / 100).toFixed(2)
    )
    if (!amountZar) return
    const paidCents = Math.round(Number(amountZar) * 100)
    const paymentDate =
      window.prompt('Payment date (YYYY-MM-DD):', new Date().toISOString().slice(0, 10)) ||
      undefined
    if (
      !window.confirm(
        `Record EFT ${ref} for ${formatZarFromCents(paidCents)} and mark this monthly batch paid? This settles all included jobs.`
      )
    ) {
      return
    }
    setActionId(batchId)
    try {
      const res = await authFetch(`/api/founder/payout-batches/${encodeURIComponent(batchId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mark_paid',
          paymentReference: ref,
          paymentMethod: 'EFT',
          amountPaidCents: paidCents,
          paymentDate,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Record EFT failed')
      await load()
      setExpandedBatch(null)
      setBatchDetail(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Record EFT failed')
    } finally {
      setActionId(null)
    }
  }

  async function openBatch(batchId: string) {
    if (expandedBatch === batchId) {
      setExpandedBatch(null)
      setBatchDetail(null)
      return
    }
    setExpandedBatch(batchId)
    try {
      const res = await authFetch(`/api/founder/payout-batches/${encodeURIComponent(batchId)}`)
      const json = await res.json()
      if (json.success) setBatchDetail(json.data)
    } catch {
      setBatchDetail(null)
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
          label: 'YA Earnings Accrued',
          value: formatZarFromCents(data.kpis.yaEarningsAccruedCents),
          hint: 'Eligible, not yet batched',
        },
        {
          label: 'Outstanding YA Liability',
          value: formatZarFromCents(data.kpis.outstandingYaLiabilityCents),
          hint: 'Accrued + awaiting EFT',
        },
        {
          label: 'YA Payouts Settled',
          value: formatZarFromCents(data.kpis.yaPayoutsSettledCents),
          hint: 'Monthly EFT recorded',
        },
        {
          label: 'Gross Contribution',
          value: formatZarFromCents(data.kpis.grossContributionCents),
          hint: 'Revenue − YA share (not profit)',
        },
      ]
    : []

  return (
    <FounderShell
      title="Finance"
      subtitle={`Commercial ledger · ${periodLabel(period)} · Monthly EFT`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <PeriodPicker value={period} onChange={(v) => setPeriod(v as FounderDashboardPeriod)} />
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
              Held job earnings: {formatZarFromCents(data.kpis.agentPayoutsHeldCents)}
            </p>
          )}
          {data.kpis.yaBatchedAwaitingEftCents > 0 && (
            <p className="text-sm text-blue-800">
              Awaiting EFT: {formatZarFromCents(data.kpis.yaBatchedAwaitingEftCents)}
            </p>
          )}

          <section>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
                  Monthly Youth Agent Payouts
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  One EFT per agent per month · jobs included by eligibleAt
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="month"
                  value={batchPeriodKey}
                  onChange={(e) => setBatchPeriodKey(e.target.value)}
                  className="min-h-[36px] rounded-md border border-slate-200 px-2 text-sm"
                />
                <select
                  value={batchStatus}
                  onChange={(e) => setBatchStatus(e.target.value)}
                  className="min-h-[36px] rounded-md border border-slate-200 bg-white px-3 text-sm"
                >
                  {BATCH_STATUS_FILTERS.map((s) => (
                    <option key={s} value={s}>
                      {s === 'all' ? 'All batch statuses' : s}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={actionId === 'generate'}
                  onClick={generateMonthlyBatches}
                  className="min-h-[36px] rounded-md bg-brand-600 px-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Generate Monthly Payouts
                </button>
              </div>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="min-w-full text-sm">
                <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Youth Agent</th>
                    <th className="px-3 py-2">Month</th>
                    <th className="px-3 py-2">Jobs</th>
                    <th className="px-3 py-2">Amount</th>
                    <th className="px-3 py-2">Bank</th>
                    <th className="px-3 py-2">Account</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.monthlyBatches.items.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-3 py-6 text-center text-slate-500">
                        No monthly batches for this filter. Generate payouts for {batchPeriodKey}.
                      </td>
                    </tr>
                  ) : (
                    data.monthlyBatches.items.map((b) => (
                      <Fragment key={b.batchId}>
                        <tr className="border-b border-slate-50">
                          <td className="px-3 py-2 font-mono text-xs">
                            {b.youthAgentUid.slice(0, 10)}…
                          </td>
                          <td className="px-3 py-2">{b.periodKey}</td>
                          <td className="px-3 py-2">{b.eligibleJobCount}</td>
                          <td className="px-3 py-2 font-semibold">
                            {formatZarFromCents(b.grossEarningsCents)}
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {b.bankSummary?.bankName || '—'}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs">
                            {b.bankSummary?.accountNumberMasked ||
                              (b.operationalStatus === 'missing_bank_details'
                                ? 'Bank details required'
                                : '—')}
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {b.operationalStatusLabel ||
                              (b.status === 'ready' ? 'Ready for EFT' : b.status)}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-1">
                              <button
                                type="button"
                                className="rounded border px-2 py-1 text-xs"
                                onClick={() => openBatch(b.batchId)}
                              >
                                {expandedBatch === b.batchId ? 'Hide' : 'View / Pay'}
                              </button>
                              {b.status === 'ready' &&
                                b.operationalStatus !== 'missing_bank_details' && (
                                  <button
                                    type="button"
                                    disabled={actionId === b.batchId}
                                    className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs"
                                    onClick={() =>
                                      markBatchPaid(b.batchId, b.grossEarningsCents)
                                    }
                                  >
                                    Record EFT
                                  </button>
                                )}
                              {b.status === 'paid' && (
                                <span className="text-xs text-slate-500">
                                  {b.paidAt?.slice(0, 10) || 'Paid'}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                        {expandedBatch === b.batchId && batchDetail && (
                          <tr>
                            <td colSpan={8} className="bg-slate-50 px-3 py-4">
                              {(() => {
                                const detail = batchDetail as {
                                  batch?: Record<string, unknown>
                                  payouts?: Array<Record<string, unknown>>
                                  agent?: { displayName?: string | null; uid?: string }
                                  liveBanking?: { isComplete?: boolean } | null
                                }
                                const batch = detail.batch || {}
                                const bank = (batch.bankingSnapshot ||
                                  batch.bankSummary ||
                                  {}) as Record<string, unknown>
                                return (
                                  <div className="grid gap-4 text-xs md:grid-cols-2">
                                    <div>
                                      <p className="font-semibold text-slate-800">Youth Agent</p>
                                      <p>
                                        {detail.agent?.displayName ||
                                          String(batch.youthAgentUid || '')}
                                      </p>
                                      <p className="font-mono text-slate-500">
                                        {String(batch.youthAgentUid || '')}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="font-semibold text-slate-800">
                                        Banking details (EFT)
                                      </p>
                                      {bank.accountHolderName ? (
                                        <ul className="mt-1 space-y-0.5 font-mono">
                                          <li>Holder: {String(bank.accountHolderName)}</li>
                                          <li>Bank: {String(bank.bankName)}</li>
                                          <li>
                                            Account:{' '}
                                            {String(
                                              bank.accountNumber || bank.accountNumberMasked || '—'
                                            )}
                                          </li>
                                          <li>Type: {String(bank.accountType || '—')}</li>
                                          <li>Branch: {String(bank.branchCode || '—')}</li>
                                          <li>
                                            Profile v{String(bank.bankingProfileVersion || '—')}
                                          </li>
                                        </ul>
                                      ) : (
                                        <p className="mt-1 text-amber-800">
                                          Bank details required
                                          {detail.liveBanking?.isComplete
                                            ? ' — agent has updated profile; record EFT to attach snapshot.'
                                            : ' — ask the Youth Agent to add banking details on their profile.'}
                                        </p>
                                      )}
                                    </div>
                                    <div className="md:col-span-2">
                                      <p className="font-semibold text-slate-800">
                                        Included briefings
                                      </p>
                                      <ul className="mt-1 space-y-1">
                                        {(detail.payouts || []).map((p) => (
                                          <li key={String(p.payoutId)} className="font-mono">
                                            {String(p.requestId)} · {String(p.tenderId)} · eligible{' '}
                                            {String(p.eligibleAt || '').slice(0, 10)} ·{' '}
                                            {formatZarFromCents(Number(p.payoutAmountCents) || 0)} ·{' '}
                                            {String(p.status)}
                                          </li>
                                        ))}
                                      </ul>
                                      {batch.status === 'ready' &&
                                        batch.operationalStatus !== 'missing_bank_details' && (
                                          <button
                                            type="button"
                                            className="mt-3 rounded border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold"
                                            disabled={actionId === b.batchId}
                                            onClick={() =>
                                              markBatchPaid(b.batchId, b.grossEarningsCents)
                                            }
                                          >
                                            Record EFT (external) & Mark Paid
                                          </button>
                                        )}
                                    </div>
                                  </div>
                                )
                              })()}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
                Job-Level Earnings
              </h2>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="min-h-[32px] rounded-md border border-slate-200 bg-white px-3 text-sm"
              >
                {JOB_STATUS_FILTERS.map((s) => (
                  <option key={s} value={s}>
                    {s === 'all' ? 'All statuses' : s}
                  </option>
                ))}
              </select>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="min-w-full text-sm">
                <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Agent</th>
                    <th className="px-3 py-2">Request</th>
                    <th className="px-3 py-2">Eligible</th>
                    <th className="px-3 py-2">Amount</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Batch</th>
                    <th className="px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.payouts.items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                        No job-level payouts in this filter.
                      </td>
                    </tr>
                  ) : (
                    data.payouts.items.map((p) => (
                      <tr key={p.payoutId} className="border-b border-slate-50">
                        <td className="px-3 py-2 font-mono text-xs">
                          {p.youthAgentUid.slice(0, 8)}…
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">{p.requestId.slice(0, 10)}…</td>
                        <td className="px-3 py-2">{p.eligibleAt?.slice(0, 10) || '—'}</td>
                        <td className="px-3 py-2">{formatZarFromCents(p.payoutAmountCents)}</td>
                        <td className="px-3 py-2 capitalize">{p.status}</td>
                        <td className="px-3 py-2 font-mono text-xs">
                          {p.settlementBatchId?.slice(0, 16) || '—'}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            {p.status === 'eligible' && !p.settlementBatchId && (
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
                            {(p.status === 'settled' || p.status === 'paid') && (
                              <span className="text-xs text-slate-500">
                                {p.settledAt?.slice(0, 10) || 'Settled'}
                              </span>
                            )}
                            {p.status === 'batched' && (
                              <span className="text-xs text-blue-700">In monthly batch</span>
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
