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
import RegistrationsPanel from '@/components/admin/RegistrationsPanel'
import { authFetch } from '@/lib/api/authenticatedFetch'
import {
  evaluateFounderAccess,
  isFounderIntelligenceEnabledClient,
} from '@/lib/founder/access'
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

const ADMIN_NAV_BASE = [
  {
    group: 'Operate',
    links: [
      { href: '/admin/registrations', label: 'Registrations' },
      { href: '/admin/operations', label: 'Operations' },
      { href: '/admin/dispatch', label: 'Dispatch' },
      { href: '/admin/agents/performance', label: 'Agents' },
      { href: '/admin/procurement-inbox', label: 'RFQ inbox' },
    ],
  },
  {
    group: 'Insight',
    links: [
      { href: '/admin/executive', label: 'Executive' },
      { href: '/admin/ai-insights', label: 'AI insights' },
      { href: '/admin/procurement-intelligence', label: 'Procurement intel' },
      { href: '/admin/fraud', label: 'Fraud' },
    ],
  },
  {
    group: 'Grow',
    links: [
      { href: '/admin/pilot', label: 'Pilot launch', accent: true },
      { href: '/admin/finance', label: 'Finance' },
      { href: '/admin/integrations', label: 'Integrations' },
      { href: '/admin/scraping', label: 'Scraping' },
    ],
  },
] as const

function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'default',
  hint,
}: {
  label: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
  tone?: 'default' | 'gold' | 'navy' | 'warn'
  hint?: string
}) {
  const toneStyles = {
    default: {
      card: 'border-slate-200/80 bg-white',
      icon: 'bg-brand-50 text-brand-800',
      label: 'text-slate-500',
      value: 'text-brand-900',
    },
    gold: {
      card: 'border-accent-200/80 bg-gradient-to-br from-accent-50/70 to-white',
      icon: 'bg-accent-100 text-accent-700',
      label: 'text-accent-800/70',
      value: 'text-brand-900',
    },
    navy: {
      card: 'border-brand-700 bg-gradient-to-br from-brand-900 to-brand-800 text-white',
      icon: 'bg-white/10 text-accent-400',
      label: 'text-brand-100/70',
      value: 'text-white',
    },
    warn: {
      card: 'border-amber-200/80 bg-gradient-to-br from-amber-50/80 to-white',
      icon: 'bg-amber-100 text-amber-700',
      label: 'text-amber-800/70',
      value: 'text-brand-900',
    },
  }[tone]

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-card ${toneStyles.card}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${toneStyles.label}`}>
            {label}
          </p>
          <p className={`mt-2 text-2xl font-bold tabular-nums tracking-tight ${toneStyles.value}`}>
            {value}
          </p>
          {hint && (
            <p className={`mt-1 text-xs ${tone === 'navy' ? 'text-brand-200/80' : 'text-slate-500'}`}>
              {hint}
            </p>
          )}
        </div>
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${toneStyles.icon} ${
            tone === 'navy' ? 'ring-white/10' : 'ring-black/5'
          }`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}

function SectionLabel({
  children,
  light = false,
}: {
  children: React.ReactNode
  light?: boolean
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] ${
        light ? 'text-accent-400' : 'text-brand-800'
      }`}
    >
      <span className="h-1.5 w-5 rounded-full bg-accent-500" aria-hidden />
      {children}
    </span>
  )
}

function formatWhen(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-ZA')
}

function HealthCell({
  label,
  value,
  tone = 'neutral',
  detail,
}: {
  label: string
  value: React.ReactNode
  tone?: 'neutral' | 'brand' | 'gold' | 'danger' | 'navy'
  detail?: React.ReactNode
}) {
  const styles = {
    neutral: 'border-slate-100 bg-slate-50/80',
    brand: 'border-brand-100 bg-brand-50/50',
    gold: 'border-accent-200/80 bg-accent-50/50',
    danger: 'border-red-100 bg-red-50/70',
    navy: 'border-brand-700 bg-gradient-to-br from-brand-900 to-brand-800 text-white',
  }[tone]
  const labelStyles = {
    neutral: 'text-slate-500',
    brand: 'text-brand-700',
    gold: 'text-accent-700',
    danger: 'text-red-700',
    navy: 'text-accent-400',
  }[tone]
  const valueStyles = {
    neutral: 'text-brand-900',
    brand: 'text-brand-900',
    gold: 'text-brand-900',
    danger: 'text-red-900',
    navy: 'text-white',
  }[tone]

  return (
    <div className={`rounded-xl border p-4 ${styles}`}>
      <dt className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${labelStyles}`}>
        {label}
      </dt>
      <dd className={`mt-2 font-semibold tabular-nums ${valueStyles}`}>{value}</dd>
      {detail}
    </div>
  )
}

export default function AdminDashboard() {
  const { user, userProfile } = useAuth()
  const { lastUpdated, syncStatus, refresh } = useTenderBriefingsPolling({
    pollIntervalMs: 15000,
  })
  const [stats, setStats] = useState<AdminDashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const { data: intelligence, loading: intelligenceLoading } = useOperationalIntelligence(15000)

  const showFounderNav = evaluateFounderAccess({
    enabled: isFounderIntelligenceEnabledClient(),
    authenticated: Boolean(user),
    userType: userProfile?.userType,
    email: user?.email || userProfile?.email,
    founderAccess: (userProfile as { founderAccess?: boolean } | null)?.founderAccess === true,
  }).ok

  const adminNav = showFounderNav
    ? ADMIN_NAV_BASE.map((group) =>
        group.group === 'Operate'
          ? {
              ...group,
              links: [
                {
                  href: '/founder/user-intelligence',
                  label: 'User Intelligence',
                  accent: true as const,
                },
                ...group.links,
              ],
            }
          : group
      )
    : ADMIN_NAV_BASE

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
  const totalOpportunities = syncState?.tenderCount ?? stats?.totalBriefings ?? 0

  return (
    <div className="space-y-8">
      {/* Command hero */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-900 via-brand-800 to-brand-950 px-6 py-8 text-white shadow-card sm:px-10">
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent-500/15 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-28 left-1/3 h-56 w-56 rounded-full bg-brand-500/20 blur-3xl"
          aria-hidden
        />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <SectionLabel light>Admin · Command center</SectionLabel>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Procurement operations
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-brand-100/80 sm:text-base">
              Official OCDS sync, Firestore production data, and live operational telemetry —
              in one place.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 ring-1 ring-inset ring-white/10">
              <SyncHealthBadge health={apiHealth} isRunning={isRunning} />
              <span className="text-xs text-brand-100/70">
                Updated {formatWhen(lastUpdated)}
              </span>
            </div>
            <button
              type="button"
              onClick={runSync}
              disabled={isRunning}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-accent-500 px-5 py-3 text-sm font-semibold text-brand-900 shadow-gold transition hover:bg-accent-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ArrowPathIcon className={`h-5 w-5 ${isRunning ? 'animate-spin' : ''}`} />
              {isRunning ? 'Sync running…' : 'Run sync now'}
            </button>
          </div>
        </div>

        <nav className="relative mt-8 space-y-3 border-t border-white/10 pt-6" aria-label="Admin sections">
          {adminNav.map((group) => (
            <div
              key={group.group}
              className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3"
            >
              <span className="w-16 shrink-0 text-[10px] font-bold uppercase tracking-[0.16em] text-brand-300/80">
                {group.group}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {group.links.map((tab) => (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={`inline-flex min-h-[34px] items-center rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      'accent' in tab && tab.accent
                        ? 'bg-accent-500/20 text-accent-300 ring-1 ring-inset ring-accent-400/40 hover:bg-accent-500/30'
                        : 'bg-white/5 text-white/75 ring-1 ring-inset ring-white/10 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </section>

      {/* Registrations — primary people directory */}
      <RegistrationsPanel compact showHeaderLink />

      {/* Core KPIs */}
      <section aria-label="Platform metrics">
        <div className="mb-3">
          <SectionLabel>Platform metrics</SectionLabel>
          <h2 className="mt-1.5 text-lg font-bold text-brand-900">Activity at a glance</h2>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Tender opportunities"
            value={stats?.totalBriefings ?? 0}
            icon={ChartBarIcon}
            tone="navy"
          />
          <StatCard
            label="Compulsory briefings"
            value={stats?.compulsoryBriefings ?? 0}
            icon={CheckCircleIcon}
            tone="gold"
          />
          <StatCard label="Active SMEs" value={stats?.activeSmes ?? 0} icon={UsersIcon} />
          <StatCard
            label="Active agents"
            value={stats?.activeYouthAgents ?? 0}
            icon={UsersIcon}
          />
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Pending attendance"
            value={stats?.pendingBriefings ?? 0}
            icon={ClockIcon}
            hint="Awaiting assignment"
          />
          <StatCard
            label="Assigned briefings"
            value={stats?.acceptedBriefings ?? 0}
            icon={CheckCircleIcon}
          />
          <StatCard
            label="Completed reports"
            value={stats?.completedBriefingReports ?? 0}
            icon={CheckCircleIcon}
            tone="gold"
          />
          <StatCard
            label="Closing within 7 days"
            value={stats?.closingWithin7Days ?? 0}
            icon={ExclamationTriangleIcon}
            tone="warn"
          />
        </div>
      </section>

      {/* Live pulse — compact */}
      <section aria-label="Live operational pulse">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <SectionLabel>Live pulse</SectionLabel>
          <p className="text-xs text-slate-500">Refreshes every 15s</p>
        </div>
        <OperationalIntelligencePanel
          data={intelligence}
          loading={intelligenceLoading}
          compact
        />
      </section>

      {/* Sync / system health */}
      <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <SectionLabel>System health</SectionLabel>
            <h2 className="mt-2 flex items-center gap-2 text-xl font-bold text-brand-900">
              <ServerStackIcon className="h-5 w-5 text-accent-500" />
              Sync status
            </h2>
          </div>
          <SyncHealthBadge health={apiHealth} isRunning={isRunning} />
        </div>

        <dl className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <HealthCell label="Storage adapter" value={adapter} tone="brand" />
          <HealthCell
            label="Last successful sync"
            value={formatWhen(syncState?.lastSuccessfulSync)}
            tone="gold"
          />
          <HealthCell
            label="Last failed sync"
            value={formatWhen(
              (syncState as { lastFailedSyncAt?: string })?.lastFailedSyncAt ||
                (syncState as { lastFailedSync?: string })?.lastFailedSync
            )}
            tone="danger"
            detail={
              (syncState as { lastFailedSyncError?: string })?.lastFailedSyncError ? (
                <p className="mt-1 text-xs text-red-700 line-clamp-2">
                  {(syncState as { lastFailedSyncError?: string }).lastFailedSyncError}
                </p>
              ) : undefined
            }
          />
          <HealthCell label="Scheduler" value="Cloud Scheduler · production" />
          <HealthCell label="OCDS API health" value={<span className="capitalize">{apiHealth}</span>} />
          <HealthCell
            label="Total opportunities"
            value={<span className="text-2xl font-bold">{totalOpportunities}</span>}
            tone="navy"
          />
        </dl>

        {syncFailed && (
          <div className="mt-4 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-900">
            <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 shrink-0" />
            <p>
              Sync health reported issues. Existing tenders are preserved. Use{' '}
              <span className="font-semibold">Run sync now</span> or wait for the next scheduled
              run.
            </p>
          </div>
        )}
      </section>

      {/* Ops + coverage */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <SectionLabel>Operations</SectionLabel>
          <h2 className="mt-2 text-lg font-bold text-brand-900">Operational health</h2>
          <dl className="mt-5 space-y-2.5 text-sm">
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
              <dt className="text-slate-500">Enrichment scraper</dt>
              <dd className="font-semibold capitalize text-brand-900">
                {syncState?.scraperHealth || 'unknown'}
              </dd>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
              <dt className="text-slate-500">SME attendance requests</dt>
              <dd className="font-semibold tabular-nums text-brand-900">
                {stats?.smeAttendanceRequests ?? 0}
              </dd>
            </div>
            <div
              className={`flex items-center justify-between rounded-xl px-4 py-3 ${
                syncFailed ? 'bg-red-50 text-red-900' : 'bg-accent-50/60'
              }`}
            >
              <dt className={syncFailed ? 'text-red-700' : 'text-accent-800'}>
                Failed syncs / errors
              </dt>
              <dd className="font-semibold">{syncFailed ? 'Review sync status' : 'None recent'}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <SectionLabel>Coverage</SectionLabel>
          <h2 className="mt-2 flex items-center gap-2 text-lg font-bold text-brand-900">
            <MapPinIcon className="h-5 w-5 text-accent-500" />
            Province coverage
          </h2>
          <div className="mt-5 flex flex-wrap gap-2">
            {(stats?.provincesRepresented || []).map((p) => (
              <span
                key={p}
                className="rounded-lg border border-brand-100 bg-brand-50/70 px-3 py-1.5 text-sm font-medium text-brand-800"
              >
                {p}
              </span>
            ))}
            {!stats?.provincesRepresented?.length && (
              <p className="text-sm text-slate-500">Run sync to populate province data.</p>
            )}
          </div>
        </section>
      </div>

      {/* Top departments */}
      <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
        <SectionLabel>Procurement intelligence</SectionLabel>
        <h2 className="mt-2 text-lg font-bold text-brand-900">Top departments</h2>
        <div className="mt-5 space-y-3">
          {(stats?.topDepartments || []).map((dept) => {
            const max = Math.max(...(stats?.topDepartments?.map((d) => d.count) || [1]), 1)
            const pct = Math.round((dept.count / max) * 100)
            return (
              <div key={dept.name}>
                <div className="flex justify-between gap-3 text-sm">
                  <span className="truncate text-slate-700">{dept.name}</span>
                  <span className="shrink-0 font-semibold tabular-nums text-brand-900">
                    {dept.count}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-800 to-accent-500 transition-[width] duration-500"
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
      </section>

      <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-200 pt-4 text-xs text-slate-500">
        <Link href="/api/health/firestore" className="font-medium hover:text-brand-800">
          Firestore health
        </Link>
        <Link href="/api/sync/status" className="font-medium hover:text-brand-800">
          Sync status JSON
        </Link>
      </div>
    </div>
  )
}
