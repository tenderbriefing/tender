'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'react-hot-toast'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { useTenderBriefingsPolling } from '@/hooks/useTenderBriefingsPolling'
import { useAuth } from '@/components/providers/AuthProvider'
import { SyncHealthBadge } from '@/components/procurement/StatusBadges'
import type { AdminDashboardStats } from '@/lib/tenderBriefing/types'
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
}: {
  label: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50">
          <Icon className="h-6 w-6 text-brand-600" />
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

  const syncState = stats?.syncStatus || syncStatus
  const isRunning = Boolean(syncing || syncState?.isRunning)

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch('/api/tender-briefings/stats/summary')
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
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-brand-700 uppercase tracking-wide">
            Admin — procurement operations
          </p>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Admin Dashboard</h1>
          <p className="mt-1 text-slate-600">
            Official OCDS sync every 15 minutes · Firestore production data
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            href="/admin/operations"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm font-semibold text-brand-800 hover:bg-brand-100"
          >
            Operations
          </Link>
          <button
            type="button"
            onClick={runSync}
            disabled={isRunning}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-5 w-5 ${isRunning ? 'animate-spin' : ''}`} />
            {isRunning ? 'Sync Running…' : 'Run Sync Now'}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <ServerStackIcon className="h-5 w-5 text-brand-600" />
            Sync Status
          </h2>
          <div className="flex items-center gap-2">
            <SyncHealthBadge health={apiHealth} isRunning={isRunning} />
            <span className="text-xs text-slate-500">
              Updated {formatWhen(lastUpdated)}
            </span>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
            <dt className="text-slate-500">Firestore adapter</dt>
            <dd className="mt-1 font-semibold text-slate-900">{adapter}</dd>
          </div>
          <div className="rounded-lg border border-green-100 bg-green-50 p-4">
            <dt className="text-green-800">Last successful sync</dt>
            <dd className="mt-1 font-semibold text-green-900">
              {formatWhen(syncState?.lastSuccessfulSync)}
            </dd>
          </div>
          <div className="rounded-lg border border-red-100 bg-red-50 p-4">
            <dt className="text-red-800">Last failed sync</dt>
            <dd className="mt-1 font-semibold text-red-900">
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
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
            <dt className="text-slate-500">Scheduler</dt>
            <dd className="mt-1 font-semibold text-slate-900">
              Cloud Scheduler · every 15 min (production)
            </dd>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
            <dt className="text-slate-500">OCDS API health</dt>
            <dd className="mt-1 font-semibold capitalize text-slate-900">{apiHealth}</dd>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
            <dt className="text-slate-500">Total Tender Opportunities</dt>
            <dd className="mt-1 font-semibold text-slate-900">
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
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Operational health</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Enrichment scraper</dt>
              <dd className="font-medium">{syncState?.scraperHealth || 'unknown'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">SME attendance requests</dt>
              <dd className="font-medium">{stats?.smeAttendanceRequests ?? 0}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Failed syncs / errors</dt>
              <dd className="font-medium text-red-700">
                {syncFailed ? 'Review sync status' : 'None recent'}
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <MapPinIcon className="h-5 w-5 text-brand-600" />
            Province coverage
          </h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {(stats?.provincesRepresented || []).map((p) => (
              <span
                key={p}
                className="rounded border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-medium text-slate-700"
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

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Top departments</h2>
        <div className="mt-4 space-y-2">
          {(stats?.topDepartments || []).map((dept) => (
            <div key={dept.name} className="flex justify-between text-sm">
              <span className="text-slate-700">{dept.name}</span>
              <span className="font-semibold text-slate-900">{dept.count}</span>
            </div>
          ))}
          {!stats?.topDepartments?.length && (
            <p className="text-sm text-slate-500">Run sync to load department statistics.</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <Link href="/api/health/firestore" className="font-semibold text-brand-700 hover:underline">
          Firestore health →
        </Link>
        <Link href="/api/sync/status" className="font-semibold text-brand-700 hover:underline">
          Sync status JSON →
        </Link>
      </div>
    </div>
  )
}
