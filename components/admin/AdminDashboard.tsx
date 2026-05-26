'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'react-hot-toast'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { useTenderBriefingsPolling } from '@/hooks/useTenderBriefingsPolling'
import { useAuth } from '@/components/providers/AuthProvider'
import { SyncHealthBadge } from '@/components/procurement/StatusBadges'
import type { AdminDashboardStats } from '@/lib/tenderBriefing/types'
import OperationalIntelligencePanel from '@/components/procurement/OperationalIntelligencePanel'
import { useOperationalIntelligence } from '@/hooks/useOperationalIntelligence'
import { authFetch } from '@/lib/api/authenticatedFetch'
import {
  ArrowPathIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  MapPinIcon,
  ServerStackIcon,
  UsersIcon,
} from '@heroicons/react/24/outline'

function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'default',
}: {
  label: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
  tone?: 'default' | 'gold' | 'navy'
}) {
  const toneStyles = {
    default: { card: 'border-slate-200 bg-white', icon: 'bg-brand-50 text-brand-800' },
    gold: { card: 'border-accent-200 bg-gradient-to-br from-accent-50/60 to-white', icon: 'bg-accent-100 text-accent-700' },
    navy: { card: 'border-brand-700 bg-gradient-to-br from-brand-900 to-brand-800 text-white', icon: 'bg-white/10 text-accent-400' },
  }[tone]
  const labelClass = tone === 'navy' ? 'text-brand-100/70' : 'text-slate-500'
  const valueClass = tone === 'navy' ? 'text-white' : 'text-brand-900'
  return (
    <div className={`group relative overflow-hidden rounded-2xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-card ${toneStyles.card}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wider ${labelClass}`}>{label}</p>
          <p className={`mt-2 text-2xl font-bold ${valueClass}`}>{value}</p>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ring-1 ring-inset ${toneStyles.icon} ${tone === 'navy' ? 'ring-white/10' : 'ring-current/10'}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  )
}

function formatWhen(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-ZA')
}

export default function AdminDashboard() {
  const { user } = useAuth()
  const { lastUpdated, syncStatus, refresh } = useTenderBriefingsPolling({
    pollIntervalMs: 15000,
  })
  const [stats, setStats] = useState<AdminDashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const { data: intelligence, loading: intelligenceLoading } = useOperationalIntelligence(15000)

  const syncState = stats?.syncStatus || syncStatus
  const isRunning = Boolean(syncing || syncState?.isRunning)

  const loadStats = useCallback(async () => {
    try {
      const res = await authFetch('/api/tender-briefings/stats/summary')
      const json = await res.json()
      if (json.success) setStats(json.data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadStats()
    const interval = setInterval(loadStats, 15000)
    return () => clearInterval(interval)
  }, [loadStats])

  const runSync = async () => {
    if (!user) {
      toast.error('Sign in as admin to run sync')
      return
    }

    setSyncing(true)
    toast.loading('Running official procurement data sync…', { id: 'admin-sync' })

    try {
      const idToken = await user.getIdToken()
      const res = await fetch('/api/admin/sync-run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ force: true }),
      })
      const json = await res.json()

      if (!res.ok || !json.success) {
        throw new Error(json.error || json.data?.error || 'Sync failed')
      }

      const processed = json.data?.stats?.processed ?? json.data?.syncLog?.processed ?? 0
      toast.success(`Sync complete — ${processed} tenders processed`, { id: 'admin-sync' })
      await Promise.all([loadStats(), refresh()])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sync failed', { id: 'admin-sync' })
      await loadStats()
    } finally {
      setSyncing(false)
    }
  }

  if (loading && !stats) {
    return (
      <div className="flex justify-center py-24">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  const adapter =
    syncState?.storageAdapter ||
    process.env.NEXT_PUBLIC_STORAGE_ADAPTER ||
    'firestore'

  const apiHealth = syncState?.apiHealth || 'unknown'
  const syncFailed = apiHealth === 'unhealthy' || apiHealth === 'failed'

  return (
    <div className="space-y-8">
      <OperationalIntelligencePanel data={intelligence} loading={intelligenceLoading} />

      <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-brand-900 via-brand-800 to-brand-950 px-6 py-8 text-white shadow-card sm:px-10">
        <div className="pointer-events-none absolute -right-32 -top-32 h-64 w-64 rounded-full bg-accent-500/15 blur-3xl" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-accent-400">
              <span className="h-1.5 w-6 rounded-full bg-accent-500" />
              Admin · Procurement operations
            </span>
            <h1 className="mt-3 text-3xl font-bold text-white sm:text-4xl">Admin Command Center</h1>
            <p className="mt-2 text-brand-100/80">
              Official OCDS sync · Firestore production data · Live operational telemetry
            </p>
          </div>
          <button
            type="button"
            onClick={runSync}
            disabled={isRunning}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 self-start rounded-xl bg-accent-500 px-5 py-3 text-sm font-semibold text-brand-900 shadow-gold transition hover:bg-accent-400 disabled:opacity-60 md:self-auto"
          >
            <ArrowPathIcon className={`h-5 w-5 ${isRunning ? 'animate-spin' : ''}`} />
            {isRunning ? 'Sync running…' : 'Run sync now'}
          </button>
        </div>

        <div className="relative mt-6 flex flex-wrap gap-2">
          {[
            { href: '/admin/operations', label: 'Operations' },
            { href: '/admin/executive', label: 'Executive' },
            { href: '/admin/pilot', label: 'Pilot launch', accent: true },
            { href: '/admin/ai-insights', label: 'AI insights' },
            { href: '/admin/procurement-intelligence', label: 'Procurement intel' },
            { href: '/admin/procurement-inbox', label: 'RFQ inbox' },
            { href: '/admin/finance', label: 'Finance' },
            { href: '/admin/integrations', label: 'Integrations' },
          ].map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`inline-flex min-h-[36px] items-center rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                tab.accent
                  ? 'bg-accent-500/20 text-accent-300 ring-1 ring-inset ring-accent-400/40 hover:bg-accent-500/30'
                  : 'bg-white/5 text-white/80 ring-1 ring-inset ring-white/10 hover:bg-white/10 hover:text-white'
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-brand-800">
              <span className="h-1.5 w-6 rounded-full bg-accent-500" />
              System health
            </span>
            <h2 className="mt-2 flex items-center gap-2 text-xl font-bold text-brand-900">
              <ServerStackIcon className="h-5 w-5 text-accent-500" />
              Sync Status
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <SyncHealthBadge health={apiHealth} isRunning={isRunning} />
            <span className="text-xs text-slate-500">
              Updated {formatWhen(lastUpdated)}
            </span>
          </div>
        </div>
        <dl className="mt-6 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-brand-100 bg-brand-50/40 p-4">
            <dt className="text-xs font-semibold uppercase tracking-wider text-brand-700">Firestore adapter</dt>
            <dd className="mt-2 font-semibold text-brand-900">{adapter}</dd>
          </div>
          <div className="rounded-xl border border-accent-200 bg-accent-50/60 p-4">
            <dt className="text-xs font-semibold uppercase tracking-wider text-accent-700">Last successful sync</dt>
            <dd className="mt-2 font-semibold text-brand-900">
              {formatWhen(syncState?.lastSuccessfulSync)}
            </dd>
          </div>
          <div className="rounded-xl border border-red-100 bg-red-50/60 p-4">
            <dt className="text-xs font-semibold uppercase tracking-wider text-red-700">Last failed sync</dt>
            <dd className="mt-2 font-semibold text-red-900">
              {formatWhen(
                (syncState as { lastFailedSyncAt?: string })?.lastFailedSyncAt ||
                  (syncState as { lastFailedSync?: string })?.lastFailedSync
              )}
            </dd>
            {(syncState as { lastFailedSyncError?: string })?.lastFailedSyncError && (
              <p className="mt-1 text-xs text-red-700 line-clamp-2">
                {(syncState as { lastFailedSyncError?: string }).lastFailedSyncError}
              </p>
            )}
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">Scheduler</dt>
            <dd className="mt-2 font-semibold text-brand-900">
              Cloud Scheduler · production
            </dd>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">OCDS API health</dt>
            <dd className="mt-2 font-semibold capitalize text-brand-900">{apiHealth}</dd>
          </div>
          <div className="rounded-xl border border-brand-100 bg-gradient-to-br from-brand-900 to-brand-800 p-4 text-white">
            <dt className="text-xs font-semibold uppercase tracking-wider text-accent-400">Total opportunities</dt>
            <dd className="mt-2 text-2xl font-bold">
              {syncState?.tenderCount ?? stats?.totalBriefings ?? 0}
            </dd>
          </div>
        </dl>
        {syncFailed && (
          <div className="mt-4 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <ExclamationTriangleIcon className="h-5 w-5 shrink-0" />
            <p>
              Sync health reported issues. Existing tenders are preserved. Use Run Sync Now or
              wait for the next scheduled run.
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Tender Opportunities"
          value={stats?.totalBriefings ?? 0}
          icon={ChartBarIcon}
        />
        <StatCard
          label="Compulsory Briefings"
          value={stats?.compulsoryBriefings ?? 0}
          icon={CheckCircleIcon}
        />
        <StatCard label="SME Activity" value={stats?.activeSmes ?? 0} icon={UsersIcon} />
        <StatCard label="Agent Activity" value={stats?.activeYouthAgents ?? 0} icon={UsersIcon} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Pending Attendance Requests"
          value={stats?.pendingBriefings ?? 0}
          icon={ClockIcon}
        />
        <StatCard
          label="Assigned Briefings"
          value={stats?.acceptedBriefings ?? 0}
          icon={CheckCircleIcon}
        />
        <StatCard
          label="Completed Reports"
          value={stats?.completedBriefingReports ?? 0}
          icon={CheckCircleIcon}
        />
        <StatCard
          label="Closing within 7 days"
          value={stats?.closingWithin7Days ?? 0}
          icon={ExclamationTriangleIcon}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-brand-800">
            <span className="h-1.5 w-6 rounded-full bg-accent-500" />
            Operations
          </span>
          <h2 className="mt-2 text-lg font-bold text-brand-900">Operational health</h2>
          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between rounded-xl bg-slate-50 px-4 py-3">
              <dt className="text-slate-500">Enrichment scraper</dt>
              <dd className="font-semibold text-brand-900">{syncState?.scraperHealth || 'unknown'}</dd>
            </div>
            <div className="flex justify-between rounded-xl bg-slate-50 px-4 py-3">
              <dt className="text-slate-500">SME attendance requests</dt>
              <dd className="font-semibold text-brand-900">{stats?.smeAttendanceRequests ?? 0}</dd>
            </div>
            <div className={`flex justify-between rounded-xl px-4 py-3 ${syncFailed ? 'bg-red-50 text-red-900' : 'bg-accent-50/60'}`}>
              <dt className={syncFailed ? 'text-red-700' : 'text-accent-700'}>Failed syncs / errors</dt>
              <dd className="font-semibold">
                {syncFailed ? 'Review sync status' : 'None recent'}
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-brand-800">
            <span className="h-1.5 w-6 rounded-full bg-accent-500" />
            Coverage
          </span>
          <h2 className="mt-2 flex items-center gap-2 text-lg font-bold text-brand-900">
            <MapPinIcon className="h-5 w-5 text-accent-500" />
            Province coverage
          </h2>
          <div className="mt-5 flex flex-wrap gap-2">
            {(stats?.provincesRepresented || []).map((p) => (
              <span
                key={p}
                className="rounded-full border border-brand-100 bg-brand-50/60 px-3 py-1 text-sm font-medium text-brand-800"
              >
                {p}
              </span>
            ))}
            {!stats?.provincesRepresented?.length && (
              <p className="text-sm text-slate-500">Run sync to populate province data.</p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-brand-800">
          <span className="h-1.5 w-6 rounded-full bg-accent-500" />
          Procurement intelligence
        </span>
        <h2 className="mt-2 text-lg font-bold text-brand-900">Top departments</h2>
        <div className="mt-5 space-y-2">
          {(stats?.topDepartments || []).map((dept) => {
            const max = Math.max(...(stats?.topDepartments?.map((d) => d.count) || [1]), 1)
            const pct = Math.round((dept.count / max) * 100)
            return (
              <div key={dept.name}>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-700">{dept.name}</span>
                  <span className="font-semibold text-brand-900">{dept.count}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-800 to-accent-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
          {!stats?.topDepartments?.length && (
            <p className="text-sm text-slate-500">Run sync to load department statistics.</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <Link href="/api/health/firestore" className="font-semibold text-brand-800 hover:text-accent-600">
          Firestore health →
        </Link>
        <Link href="/api/sync/status" className="font-semibold text-brand-800 hover:text-accent-600">
          Sync status JSON →
        </Link>
      </div>
    </div>
  )
}
