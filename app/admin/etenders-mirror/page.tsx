'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ProcurementPageHeader from '@/components/procurement/ProcurementPageHeader'
import { useAuth } from '@/components/providers/AuthProvider'
import { authFetch } from '@/lib/api/authenticatedFetch'

type MirrorRow = {
  id: string
  tenderNumber?: string
  title?: string
  department?: string
  status?: string
  sourceBriefingCompulsory?: boolean | null
  derivedBriefingStatus?: string | null
  briefingCompulsory?: boolean
  documentCount?: number
  rawSourceSnapshot?: Record<string, unknown> | null
}

type DayRow = {
  date: string
  status?: string
  ocdsStatus?: string
  websiteStatus?: string | null
  sourceType?: string | null
  attemptCount?: number
  recoveryAttemptCount?: number
  sourceCount?: number
  ocdsCount?: number
  websiteDiscoverableCount?: number | null
  mirrorCount?: number
  websiteOnlyCount?: number
  ocdsOnlyCount?: number
  missingLocallyCount?: number
  fieldMismatchCount?: number
  fieldDifferenceCount?: number
  httpStatus?: number | null
  lastSuccessAt?: string | null
  lastChecked?: string | null
  nextRetryAt?: string | null
  parityStatus?: string | null
  error?: string | null
  certified?: boolean
}

type Summary = {
  dateFrom: string
  dateTo: string
  totalCalendarDays: number
  byStatus: Record<string, number>
  successfulReleaseApiDays: number
  successfulBulkRecoveryDays: number
  unresolvedUnavailableDays: number
  partialDays: number
  pendingDays: number
  totalSourceRecords: number
  totalMatched: number
  totalMissingLocally: number
  totalFieldMismatches: number
  days: DayRow[]
}

type ParitySummary = {
  totalWebsiteDiscoverable?: number
  totalWebsiteOnly?: number
  totalOcdsOnly?: number
  unresolvedUnavailableDays?: number
  days?: DayRow[]
}

type ExceptionRow = {
  id: string
  category: string
  date?: string | null
  tenderNumber?: string | null
  title?: string | null
  detail?: string | null
  status?: string
}

function statusClass(status: string) {
  switch (status) {
    case 'SUCCESS':
      return 'bg-emerald-100 text-emerald-900'
    case 'SOURCE_UNAVAILABLE':
      return 'bg-amber-100 text-amber-950'
    case 'PARTIAL':
      return 'bg-orange-100 text-orange-950'
    case 'FAILED':
      return 'bg-red-100 text-red-900'
    case 'RUNNING':
      return 'bg-sky-100 text-sky-900'
    default:
      return 'bg-slate-100 text-slate-700'
  }
}

export default function AdminEtendersMirrorPage() {
  const { user, userProfile, loading } = useAuth()
  const router = useRouter()
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [rows, setRows] = useState<MirrorRow[]>([])
  const [totalMatched, setTotalMatched] = useState(0)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [paritySummary, setParitySummary] = useState<ParitySummary | null>(null)
  const [exceptions, setExceptions] = useState<ExceptionRow[]>([])
  const [selectedDay, setSelectedDay] = useState<Record<string, unknown> | null>(null)
  const [lookback, setLookback] = useState(30)
  const [tab, setTab] = useState<'days' | 'exceptions'>('days')

  const loadDays = useCallback(async () => {
    const res = await authFetch(
      `/api/admin/etenders-mirror?view=days&lookbackDays=${lookback}`
    )
    const json = await res.json()
    if (!json.success) {
      toast.error(json.error || 'Failed to load day status')
      return
    }
    setSummary(json.data.summary as Summary)
    setParitySummary((json.data.paritySummary as ParitySummary) || null)
  }, [lookback])

  const loadExceptions = useCallback(async () => {
    const res = await authFetch('/api/admin/etenders-mirror?view=exceptions&limit=200')
    const json = await res.json()
    if (!json.success) {
      toast.error(json.error || 'Failed to load exceptions')
      return
    }
    setExceptions((json.data.exceptions as ExceptionRow[]) || [])
  }, [])

  useEffect(() => {
    if (!loading) {
      if (!user) router.push('/auth/signin')
      else if (userProfile?.userType !== 'admin') router.push('/dashboard')
    }
  }, [user, userProfile, loading, router])

  useEffect(() => {
    if (user && userProfile?.userType === 'admin') {
      loadDays().catch(() => toast.error('Day status load failed'))
      loadExceptions().catch(() => toast.error('Exceptions load failed'))
    }
  }, [user, userProfile, loadDays, loadExceptions])

  async function onSearch(e?: FormEvent) {
    e?.preventDefault()
    if (!q.trim()) {
      toast.error('Enter a tender number, title, or institution')
      return
    }
    setBusy(true)
    try {
      const res = await authFetch(
        `/api/admin/etenders-mirror?q=${encodeURIComponent(q.trim())}&limit=50`
      )
      const json = await res.json()
      if (!json.success) {
        toast.error(json.error || 'Search failed')
        return
      }
      setRows(json.data || [])
      setTotalMatched(json.totalMatched || 0)
      if (!(json.data || []).length) toast('No mirror matches')
    } catch {
      toast.error('Search failed')
    } finally {
      setBusy(false)
    }
  }

  async function runAction(action: string, body: Record<string, unknown> = {}) {
    setBusy(true)
    try {
      const res = await authFetch('/api/admin/etenders-mirror', {
        method: 'POST',
        body: JSON.stringify({ action, lookbackDays: lookback, ...body }),
      })
      const json = await res.json()
      if (!json.success) {
        toast.error(json.error || 'Action failed')
        return
      }
      toast.success(`${action.replace(/_/g, ' ')} OK`)
      await loadDays()
      if (action === 'replay_day' && body.date) {
        const dayRes = await authFetch(
          `/api/admin/etenders-mirror?view=day&date=${body.date}`
        )
        const dayJson = await dayRes.json()
        if (dayJson.success) setSelectedDay(dayJson.data.record)
      }
    } catch {
      toast.error('Action failed')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <LoadingSpinner size="lg" />
      </div>
    )
  }
  if (!user || userProfile?.userType !== 'admin') return null

  return (
    <div className="procurement-shell">
      <Header />
      <ProcurementPageHeader
        kicker="Operations"
        title="eTenders mirror"
        description="Full OCDS mirror search plus day-level recovery, website parity probes, and exceptions. OCDS parity is not website parity."
        breadcrumb={{ label: 'Admin dashboard', href: '/admin/dashboard' }}
      />
      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap gap-2 text-sm">
          <button
            type="button"
            className={`rounded px-3 py-1.5 ${tab === 'days' ? 'bg-slate-900 text-white' : 'border border-slate-300'}`}
            onClick={() => setTab('days')}
          >
            Days
          </button>
          <button
            type="button"
            className={`rounded px-3 py-1.5 ${tab === 'exceptions' ? 'bg-slate-900 text-white' : 'border border-slate-300'}`}
            onClick={() => {
              setTab('exceptions')
              loadExceptions().catch(() => null)
            }}
          >
            Exceptions ({exceptions.length})
          </button>
          <Link
            href="/admin/sme-connect"
            className="rounded border border-slate-300 px-3 py-1.5 hover:bg-slate-50"
          >
            SME Connect
          </Link>
        </div>

        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                Day reconciliation
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {summary
                  ? `${summary.dateFrom} → ${summary.dateTo} · ${summary.totalCalendarDays} days`
                  : 'Loading…'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                className="rounded border border-slate-300 px-2 py-1.5 text-sm"
                value={lookback}
                disabled={busy}
                onChange={(e) => setLookback(Number(e.target.value))}
              >
                <option value={7}>Last 7 days</option>
                <option value={30}>Last 30 days</option>
                <option value={90}>Last 90 days</option>
              </select>
              <button
                type="button"
                disabled={busy}
                className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-60"
                onClick={() => loadDays()}
              >
                Refresh
              </button>
              <button
                type="button"
                disabled={busy}
                className="rounded-lg bg-brand-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
                onClick={() => runAction('plan_backfill')}
              >
                Plan backfill
              </button>
              <button
                type="button"
                disabled={busy}
                className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
                onClick={() => runAction('backfill_tick', { maxDaysPerTick: 3 })}
              >
                Run tick (3 days)
              </button>
              <button
                type="button"
                disabled={busy}
                className="rounded border border-amber-400 px-3 py-1.5 text-sm text-amber-950 hover:bg-amber-50 disabled:opacity-60"
                onClick={() => runAction('backfill_tick', { failedOnly: true, maxDaysPerTick: 5 })}
              >
                Retry failed
              </button>
              <button
                type="button"
                disabled={busy}
                className="rounded border border-violet-400 px-3 py-1.5 text-sm text-violet-950 hover:bg-violet-50 disabled:opacity-60"
                onClick={() => runAction('run_parity', { maxDays: 5 })}
              >
                Run parity
              </button>
              <button
                type="button"
                disabled={busy}
                className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-60"
                onClick={() => runAction('classify_briefings', { limit: 300 })}
              >
                Classify briefings
              </button>
              <button
                type="button"
                disabled={busy}
                className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-60"
                onClick={() => runAction('historical_backfill', { limit: 500 })}
              >
                Historical source backfill
              </button>
            </div>
          </div>

          {summary ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Release API SUCCESS" value={summary.successfulReleaseApiDays} />
              <Stat label="Bulk recovery SUCCESS" value={summary.successfulBulkRecoveryDays} />
              <Stat
                label="SOURCE_UNAVAILABLE"
                value={summary.unresolvedUnavailableDays}
                warn={summary.unresolvedUnavailableDays > 0}
              />
              <Stat
                label="missingLocally (sum)"
                value={summary.totalMissingLocally}
                warn={summary.totalMissingLocally > 0}
              />
              <Stat label="Source records" value={summary.totalSourceRecords} />
              <Stat label="Matched" value={summary.totalMatched} />
              <Stat label="Field mismatches" value={summary.totalFieldMismatches} />
              <Stat label="PARTIAL days" value={summary.partialDays} />
            </div>
          ) : null}

          {tab === 'days' ? (
            <>
              <div className="overflow-x-auto rounded-lg border border-slate-100">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                    <tr>
                      <th className="px-2 py-2">Date</th>
                      <th className="px-2 py-2">OCDS</th>
                      <th className="px-2 py-2">Website</th>
                      <th className="px-2 py-2">OCDS #</th>
                      <th className="px-2 py-2">Web #</th>
                      <th className="px-2 py-2">Mirror</th>
                      <th className="px-2 py-2">Missing</th>
                      <th className="px-2 py-2">Diffs</th>
                      <th className="px-2 py-2">Recovery</th>
                      <th className="px-2 py-2">Parity</th>
                      <th className="px-2 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(paritySummary?.days || summary?.days || []).map((d) => {
                      const ocdsStatus = d.ocdsStatus || d.status || 'PENDING'
                      const websiteStatus = d.websiteStatus || 'PENDING'
                      return (
                        <tr
                          key={d.date}
                          className={`border-t border-slate-100 ${
                            ocdsStatus === 'SOURCE_UNAVAILABLE' || websiteStatus === 'SOURCE_UNAVAILABLE'
                              ? 'bg-amber-50/60'
                              : ''
                          }`}
                        >
                          <td className="px-2 py-1.5 font-mono text-xs">{d.date}</td>
                          <td className="px-2 py-1.5">
                            <span
                              className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${statusClass(ocdsStatus)}`}
                            >
                              {ocdsStatus}
                            </span>
                          </td>
                          <td className="px-2 py-1.5">
                            <span
                              className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${statusClass(websiteStatus)}`}
                            >
                              {websiteStatus}
                            </span>
                          </td>
                          <td className="px-2 py-1.5 text-xs">
                            {d.ocdsCount ?? d.sourceCount ?? 0}
                          </td>
                          <td className="px-2 py-1.5 text-xs">
                            {d.websiteDiscoverableCount == null ? '—' : d.websiteDiscoverableCount}
                          </td>
                          <td className="px-2 py-1.5 text-xs">{d.mirrorCount ?? '—'}</td>
                          <td className="px-2 py-1.5 text-xs">{d.missingLocallyCount ?? 0}</td>
                          <td className="px-2 py-1.5 text-xs">
                            {d.fieldDifferenceCount ?? d.fieldMismatchCount ?? 0}
                          </td>
                          <td className="px-2 py-1.5 text-xs">
                            {d.recoveryAttemptCount ?? d.attemptCount ?? 0}
                          </td>
                          <td className="px-2 py-1.5 text-[10px] font-medium text-slate-700">
                            {d.parityStatus || '—'}
                          </td>
                          <td className="px-2 py-1.5 whitespace-nowrap">
                            <button
                              type="button"
                              disabled={busy}
                              className="mr-2 text-xs font-medium text-brand-700 hover:underline disabled:opacity-60"
                              onClick={() =>
                                runAction('recover_day', { date: d.date, force: true })
                              }
                            >
                              Recover
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              className="text-xs text-slate-600 hover:underline disabled:opacity-60"
                              onClick={async () => {
                                const res = await authFetch(
                                  `/api/admin/etenders-mirror?view=day&date=${d.date}`
                                )
                                const json = await res.json()
                                if (json.success) setSelectedDay(json.data.record)
                              }}
                            >
                              Detail
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {selectedDay ? (
                <pre className="max-h-64 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">
                  {JSON.stringify(selectedDay, null, 2)}
                </pre>
              ) : null}
            </>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-100">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                  <tr>
                    <th className="px-2 py-2">Category</th>
                    <th className="px-2 py-2">Date</th>
                    <th className="px-2 py-2">Tender</th>
                    <th className="px-2 py-2">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {exceptions.map((ex) => (
                    <tr key={ex.id} className="border-t border-slate-100">
                      <td className="px-2 py-1.5 text-xs font-semibold text-amber-900">
                        {ex.category}
                      </td>
                      <td className="px-2 py-1.5 font-mono text-xs">{ex.date || '—'}</td>
                      <td className="px-2 py-1.5 text-xs">
                        {ex.tenderNumber || '—'}
                        <div className="truncate text-slate-500">{ex.title || ''}</div>
                      </td>
                      <td className="px-2 py-1.5 text-xs text-slate-600">{ex.detail || '—'}</td>
                    </tr>
                  ))}
                  {!exceptions.length ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-8 text-center text-slate-500">
                        No open exceptions.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
            Mirror search
          </h2>
          <form onSubmit={onSearch} className="flex flex-wrap gap-2">
            <input
              className="min-w-[16rem] flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="Tender / RFQ number, title, institution…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              Search mirror
            </button>
            <Link
              href="/admin/dashboard"
              className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
            >
              Dashboard
            </Link>
          </form>
          <p className="text-xs text-slate-500">
            Showing {rows.length} of {totalMatched} match(es).
          </p>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-600">
                <tr>
                  <th className="px-3 py-2">Tender #</th>
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2">Source compulsory</th>
                  <th className="px-3 py-2">Derived</th>
                  <th className="px-3 py-2">Catalogue</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100">
                    <td className="px-3 py-2 font-mono text-xs">
                      <Link
                        href={`/tenders/${r.id}`}
                        className="text-brand-700 underline-offset-2 hover:underline"
                      >
                        {r.tenderNumber || r.id}
                      </Link>
                    </td>
                    <td className="max-w-xs truncate px-3 py-2">{r.title || '—'}</td>
                    <td className="px-3 py-2">
                      {r.sourceBriefingCompulsory == null
                        ? 'null'
                        : String(r.sourceBriefingCompulsory)}
                    </td>
                    <td className="px-3 py-2 text-xs">{r.derivedBriefingStatus || '—'}</td>
                    <td className="px-3 py-2">{r.briefingCompulsory ? 'yes' : 'no'}</td>
                  </tr>
                ))}
                {!rows.length ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                      Search by a reference from eTenders to verify the local mirror.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}

function Stat({
  label,
  value,
  warn,
}: {
  label: string
  value: number
  warn?: boolean
}) {
  return (
    <div
      className={`rounded-lg border px-3 py-2 ${warn ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  )
}
