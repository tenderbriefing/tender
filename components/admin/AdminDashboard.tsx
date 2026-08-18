'use client'

import { useCallback, useEffect, useId, useState } from 'react'
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
import AdminFeatureFlagsReadOnly from '@/components/admin/AdminFeatureFlagsReadOnly'
import { authFetch } from '@/lib/api/authenticatedFetch'
import {
  evaluateFounderAccess,
  isFounderIntelligenceEnabledClient,
} from '@/lib/founder/access'
import { trackProductEvent } from '@/lib/founder/trackProductEvent'
import {
  CONTROL_CENTRE_PRIMARY_ACTIONS,
  CONTROL_CENTRE_TABS,
  filterAdminModules,
  type ControlCentreTabId,
} from '@/lib/admin/controlCentre'
import {
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  ExclamationTriangleIcon,
  MapPinIcon,
  ServerStackIcon,
} from '@heroicons/react/24/outline'

function formatWhen(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-ZA')
}

function StatusDot({ tone }: { tone: 'ok' | 'warn' | 'danger' | 'neutral' }) {
  const color = {
    ok: 'bg-emerald-500',
    warn: 'bg-amber-500',
    danger: 'bg-red-500',
    neutral: 'bg-slate-400',
  }[tone]
  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${color}`} aria-hidden />
}

export default function AdminDashboard() {
  const { user, userProfile } = useAuth()
  const { lastUpdated, syncStatus, refresh } = useTenderBriefingsPolling({
    enabled: false,
  })
  const [stats, setStats] = useState<AdminDashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [tab, setTab] = useState<ControlCentreTabId>('overview')
  const [automationSummary, setAutomationSummary] = useState<{
    failedJobs: number
    whatsappConfigured: boolean
    checkedAt: string | null
  } | null>(null)
  const [payfastStatus, setPayfastStatus] = useState<string | null>(null)
  const { data: intelligence, loading: intelligenceLoading } = useOperationalIntelligence(60000)
  const tabsId = useId()

  const showFounderNav = evaluateFounderAccess({
    enabled: isFounderIntelligenceEnabledClient(),
    authenticated: Boolean(user),
    userType: userProfile?.userType,
    email: user?.email || userProfile?.email,
    founderAccess: (userProfile as { founderAccess?: boolean } | null)?.founderAccess === true,
  }).ok

  const moduleGroups = filterAdminModules({ showFounder: showFounderNav })

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

  const loadOpsSignals = useCallback(async () => {
    try {
      const [autoRes, integRes] = await Promise.all([
        authFetch('/api/admin/automation-health'),
        authFetch('/api/integrations/health'),
      ])
      const autoJson = await autoRes.json()
      if (autoJson.success && autoJson.data) {
        const jobs = Array.isArray(autoJson.data.jobs) ? autoJson.data.jobs : []
        const failedJobs = jobs.filter(
          (j: { lastStatus?: string; status?: string }) =>
            String(j.lastStatus || j.status || '').toLowerCase().includes('fail')
        ).length
        setAutomationSummary({
          failedJobs,
          whatsappConfigured: Boolean(autoJson.data.whatsapp?.configured),
          checkedAt: autoJson.data.checkedAt || null,
        })
      }
      const integJson = await integRes.json()
      if (integJson.ok && Array.isArray(integJson.integrations)) {
        const payfast =
          integJson.integrations.find(
            (i: { id?: string; name?: string }) =>
              i.id === 'payfast' || String(i.name || '').toLowerCase().includes('payfast')
          ) ||
          integJson.integrations.find(
            (i: { id?: string }) => i.id === 'yoco' || i.id === 'payments'
          )
        setPayfastStatus(payfast?.status || null)
      }
    } catch {
      /* non-blocking secondary signals */
    }
  }, [])

  useEffect(() => {
    loadStats()
    loadOpsSignals()
    const interval = setInterval(loadStats, 30000)
    return () => clearInterval(interval)
  }, [loadStats, loadOpsSignals])

  useEffect(() => {
    void trackProductEvent('dashboard_viewed', {
      pagePath: '/admin/dashboard',
      feature: showFounderNav ? 'founder_control_centre' : 'admin_control_centre',
      metadata: {
        path: '/admin/dashboard',
        feature: showFounderNav ? 'founder_control_centre' : 'admin_control_centre',
      },
    })
  }, [showFounderNav])

  const runSync = async () => {
    if (!user) {
      toast.error('Sign in as admin to run sync')
      return
    }

    setSyncing(true)
    toast.loading('Running official procurement data sync…', { id: 'admin-sync' })
    void trackProductEvent('navigation_selected', {
      pagePath: '/admin/dashboard',
      feature: 'admin_control_centre',
      metadata: { navItem: 'run_sync', path: '/admin/dashboard' },
    })

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
      await Promise.all([loadStats(), refresh(), loadOpsSignals()])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sync failed', { id: 'admin-sync' })
      await loadStats()
    } finally {
      setSyncing(false)
    }
  }

  const onModuleNav = (href: string, label: string) => {
    void trackProductEvent('navigation_selected', {
      pagePath: '/admin/dashboard',
      feature: 'admin_control_centre',
      metadata: { navItem: label, path: href },
    })
  }

  if (loading && !stats) {
    return (
      <div className="flex justify-center py-24" role="status" aria-label="Loading control centre">
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
  const lastFailed =
    (syncState as { lastFailedSyncAt?: string })?.lastFailedSyncAt ||
    (syncState as { lastFailedSync?: string })?.lastFailedSync
  const lastFailedError = (syncState as { lastFailedSyncError?: string })?.lastFailedSyncError

  const syncTone: 'ok' | 'warn' | 'danger' | 'neutral' = isRunning
    ? 'warn'
    : syncFailed
      ? 'danger'
      : apiHealth === 'healthy' || apiHealth === 'ok'
        ? 'ok'
        : 'neutral'

  const automationTone: 'ok' | 'warn' | 'danger' | 'neutral' =
    automationSummary == null
      ? 'neutral'
      : automationSummary.failedJobs > 0
        ? 'danger'
        : 'ok'

  const payTone: 'ok' | 'warn' | 'danger' | 'neutral' =
    payfastStatus === 'configured'
      ? 'ok'
      : payfastStatus === 'error'
        ? 'danger'
        : payfastStatus
          ? 'warn'
          : 'neutral'

  const openRequests = stats?.pendingBriefings ?? 0

  const kpis = [
    { label: 'Opportunities', value: stats?.totalBriefings ?? 0 },
    { label: 'Compulsory', value: stats?.compulsoryBriefings ?? 0 },
    { label: 'Active SMEs', value: stats?.activeSmes ?? 0 },
    { label: 'Active agents', value: stats?.activeYouthAgents ?? 0 },
    { label: 'Pending', value: openRequests, hint: 'Awaiting assignment' },
    { label: 'Closing ≤7d', value: stats?.closingWithin7Days ?? 0, warn: true },
  ]

  return (
    <div className="admin-control-centre space-y-6">
      {/* 1. Page header — one composition */}
      <header className="border-b border-slate-200/90 pb-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-800">
              Admin · Operations
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-brand-900 sm:text-3xl">
              Operations console
            </h1>
            <p className="mt-1 max-w-xl text-sm text-slate-600">
              Sync health, queues, and daily actions. Modules stay one tap away.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
              <SyncHealthBadge health={apiHealth} isRunning={isRunning} />
              <span className="text-xs text-slate-500">
                Updated {formatWhen(lastUpdated)}
              </span>
            </div>
            <button
              type="button"
              onClick={runSync}
              disabled={isRunning}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-brand-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ArrowPathIcon className={`h-4 w-4 ${isRunning ? 'animate-spin' : ''}`} />
              {isRunning ? 'Sync running…' : 'Run sync'}
            </button>
          </div>
        </div>
      </header>

      {/* 2. At-a-glance status */}
      <section
        aria-label="At a glance status"
        className="overflow-x-auto rounded-lg border border-slate-200 bg-white"
      >
        <ul className="flex min-w-[640px] divide-x divide-slate-100 sm:min-w-0 sm:grid sm:grid-cols-2 lg:grid-cols-5 lg:divide-x">
          <li className="flex items-start gap-2.5 px-4 py-3.5">
            <StatusDot tone={syncTone} />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Sync
              </p>
              <p className="mt-0.5 text-sm font-semibold capitalize text-brand-900">
                {isRunning ? 'Running' : apiHealth}
              </p>
              <p className="text-xs text-slate-500">
                Last OK {formatWhen(syncState?.lastSuccessfulSync)}
              </p>
            </div>
          </li>
          <li className="flex items-start gap-2.5 px-4 py-3.5">
            <StatusDot tone={automationTone} />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Automation
              </p>
              <p className="mt-0.5 text-sm font-semibold text-brand-900">
                {automationSummary == null
                  ? 'Checking…'
                  : automationSummary.failedJobs > 0
                    ? `${automationSummary.failedJobs} failed job(s)`
                    : 'Healthy'}
              </p>
              <p className="text-xs text-slate-500">
                WhatsApp{' '}
                {automationSummary?.whatsappConfigured ? 'configured' : 'not configured'}
              </p>
            </div>
          </li>
          <li className="flex items-start gap-2.5 px-4 py-3.5">
            <StatusDot tone={payTone} />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Payments
              </p>
              <p className="mt-0.5 text-sm font-semibold capitalize text-brand-900">
                {payfastStatus ? `PayFast · ${payfastStatus}` : 'PayFast · unknown'}
              </p>
              <Link
                href="/admin/integrations"
                onClick={() => onModuleNav('/admin/integrations', 'Integrations')}
                className="text-xs font-medium text-brand-800 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-800"
              >
                Open integrations
              </Link>
            </div>
          </li>
          <li className="flex items-start gap-2.5 px-4 py-3.5">
            <StatusDot tone={openRequests > 0 ? 'warn' : 'ok'} />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Open requests
              </p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums text-brand-900">
                {openRequests} pending
              </p>
              <p className="text-xs text-slate-500">
                {stats?.acceptedBriefings ?? 0} assigned · {stats?.smeAttendanceRequests ?? 0}{' '}
                SME requests
              </p>
            </div>
          </li>
          <li className="flex items-start gap-2.5 px-4 py-3.5 sm:col-span-2 lg:col-span-1">
            <StatusDot tone={lastFailed ? 'danger' : 'ok'} />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Last failed sync
              </p>
              <p className="mt-0.5 text-sm font-semibold text-brand-900">
                {formatWhen(lastFailed)}
              </p>
              {lastFailedError ? (
                <p className="truncate text-xs text-red-700" title={lastFailedError}>
                  {lastFailedError}
                </p>
              ) : (
                <p className="text-xs text-slate-500">No recent failure detail</p>
              )}
            </div>
          </li>
        </ul>
      </section>

      {/* 3. Primary actions */}
      <section aria-label="Primary actions">
        <h2 className="sr-only">Primary actions</h2>
        <div
          className={`grid grid-cols-2 gap-2 ${
            showFounderNav ? 'sm:grid-cols-3 lg:grid-cols-5' : 'sm:grid-cols-4'
          }`}
        >
          {(showFounderNav
            ? [
                {
                  href: '/founder',
                  label: 'Founder home',
                  description: 'Pulse and intelligence',
                },
                ...CONTROL_CENTRE_PRIMARY_ACTIONS,
              ]
            : CONTROL_CENTRE_PRIMARY_ACTIONS
          ).map((action) => (
            <Link
              key={action.href}
              href={action.href}
              onClick={() => onModuleNav(action.href, action.label)}
              className="group flex min-h-[72px] flex-col justify-center rounded-lg border border-slate-200 bg-white px-3.5 py-3 transition hover:border-brand-300 hover:bg-brand-50/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-800"
            >
              <span className="text-sm font-semibold text-brand-900 group-hover:text-brand-800">
                {action.label}
              </span>
              <span className="mt-0.5 text-xs text-slate-500">{action.description}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* 4. KPI strip — one metric group */}
      <section
        aria-label="Platform metrics"
        className="rounded-lg border border-slate-200 bg-white"
      >
        <div className="border-b border-slate-100 px-4 py-2.5 sm:px-5">
          <h2 className="text-sm font-semibold text-brand-900">Platform metrics</h2>
        </div>
        <dl className="grid grid-cols-2 divide-y divide-slate-100 sm:grid-cols-3 lg:grid-cols-6 lg:divide-y-0">
          {kpis.map((kpi) => (
            <div
              key={kpi.label}
              className="px-4 py-3.5 sm:px-5 lg:border-l lg:border-slate-100 lg:first:border-l-0"
            >
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {kpi.label}
              </dt>
              <dd
                className={`mt-1 text-xl font-bold tabular-nums tracking-tight ${
                  kpi.warn ? 'text-amber-800' : 'text-brand-900'
                }`}
              >
                {kpi.value}
              </dd>
              {'hint' in kpi && kpi.hint ? (
                <p className="mt-0.5 text-[11px] text-slate-500">{kpi.hint}</p>
              ) : null}
            </div>
          ))}
        </dl>
      </section>

      {/* 5. Secondary modules via tabs */}
      <section aria-label="Control centre panels" className="space-y-4">
        <div
          role="tablist"
          aria-label="Control centre sections"
          className="flex gap-1 overflow-x-auto border-b border-slate-200 pb-px"
        >
          {CONTROL_CENTRE_TABS.map((t) => {
            const selected = tab === t.id
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`${tabsId}-${t.id}`}
                aria-selected={selected}
                aria-controls={`${tabsId}-panel-${t.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => {
                  setTab(t.id)
                  void trackProductEvent('navigation_selected', {
                    pagePath: '/admin/dashboard',
                    feature: 'admin_control_centre',
                    metadata: { navItem: `tab_${t.id}`, path: '/admin/dashboard' },
                  })
                }}
                className={`min-h-[40px] shrink-0 rounded-t-lg border border-transparent px-3.5 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-800 ${
                  selected
                    ? '-mb-px border-slate-200 border-b-white bg-white text-brand-900'
                    : 'text-slate-600 hover:bg-slate-100/80 hover:text-brand-800'
                }`}
              >
                {t.label}
              </button>
            )
          })}
        </div>

        <div
          role="tabpanel"
          id={`${tabsId}-panel-${tab}`}
          aria-labelledby={`${tabsId}-${tab}`}
          className="space-y-5"
        >
          {tab === 'overview' && (
            <>
              <div>
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <h2 className="text-sm font-semibold text-brand-900">Live pulse</h2>
                  <p className="text-xs text-slate-500">Refreshes every 15s</p>
                </div>
                <OperationalIntelligencePanel
                  data={intelligence}
                  loading={intelligenceLoading}
                  compact
                />
              </div>

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <div>
                  <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-brand-900">
                    <MapPinIcon className="h-4 w-4 text-accent-500" aria-hidden />
                    Province coverage
                  </h2>
                  <div className="flex flex-wrap gap-1.5">
                    {(stats?.provincesRepresented || []).map((p) => (
                      <span
                        key={p}
                        className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-brand-800"
                      >
                        {p}
                      </span>
                    ))}
                    {!stats?.provincesRepresented?.length && (
                      <p className="text-sm text-slate-500">Run sync to populate province data.</p>
                    )}
                  </div>
                </div>

                <div>
                  <h2 className="mb-2 text-sm font-semibold text-brand-900">Top departments</h2>
                  <div className="space-y-2.5">
                    {(stats?.topDepartments || []).slice(0, 5).map((dept) => {
                      const max = Math.max(
                        ...(stats?.topDepartments?.map((d) => d.count) || [1]),
                        1
                      )
                      const pct = Math.round((dept.count / max) * 100)
                      return (
                        <div key={dept.name}>
                          <div className="flex justify-between gap-3 text-xs">
                            <span className="truncate text-slate-700">{dept.name}</span>
                            <span className="shrink-0 font-semibold tabular-nums text-brand-900">
                              {dept.count}
                            </span>
                          </div>
                          <div className="mt-1 h-1 overflow-hidden rounded-sm bg-slate-100">
                            <div
                              className="h-full bg-brand-800 transition-[width] duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                    {!stats?.topDepartments?.length && (
                      <p className="text-sm text-slate-500">
                        Run sync to load department statistics.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                <span>
                  Assigned {stats?.acceptedBriefings ?? 0} · Completed reports{' '}
                  {stats?.completedBriefingReports ?? 0}
                </span>
                <Link
                  href="/admin/operations"
                  onClick={() => onModuleNav('/admin/operations', 'Operations')}
                  className="font-medium text-brand-800 hover:underline"
                >
                  Open operations board
                </Link>
              </div>
            </>
          )}

          {tab === 'people' && (
            <RegistrationsPanel compact showHeaderLink />
          )}

          {tab === 'system' && (
            <div className="space-y-5">
              <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-brand-900">
                      <ServerStackIcon className="h-4 w-4 text-accent-500" aria-hidden />
                      Sync status
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Official OCDS sync · {adapter}
                    </p>
                  </div>
                  <SyncHealthBadge health={apiHealth} isRunning={isRunning} />
                </div>

                <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="rounded-md bg-slate-50 px-3 py-2.5">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Storage
                    </dt>
                    <dd className="mt-1 text-sm font-semibold text-brand-900">{adapter}</dd>
                  </div>
                  <div className="rounded-md bg-slate-50 px-3 py-2.5">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Last successful sync
                    </dt>
                    <dd className="mt-1 text-sm font-semibold text-brand-900">
                      {formatWhen(syncState?.lastSuccessfulSync)}
                    </dd>
                  </div>
                  <div className="rounded-md bg-red-50/70 px-3 py-2.5">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-red-700">
                      Last failed sync
                    </dt>
                    <dd className="mt-1 text-sm font-semibold text-red-900">
                      {formatWhen(lastFailed)}
                    </dd>
                    {lastFailedError ? (
                      <p className="mt-1 line-clamp-2 text-xs text-red-700">{lastFailedError}</p>
                    ) : null}
                  </div>
                  <div className="rounded-md bg-slate-50 px-3 py-2.5">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Scheduler
                    </dt>
                    <dd className="mt-1 text-sm font-semibold text-brand-900">
                      Cloud Scheduler · production
                    </dd>
                  </div>
                  <div className="rounded-md bg-slate-50 px-3 py-2.5">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Enrichment scraper
                    </dt>
                    <dd className="mt-1 text-sm font-semibold capitalize text-brand-900">
                      {syncState?.scraperHealth || 'unknown'}
                    </dd>
                  </div>
                  <div className="rounded-md bg-brand-900 px-3 py-2.5 text-white">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-brand-200">
                      Total opportunities
                    </dt>
                    <dd className="mt-1 text-xl font-bold tabular-nums">{totalOpportunities}</dd>
                  </div>
                </dl>

                {syncFailed && (
                  <div className="mt-4 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
                    <p>
                      Sync health reported issues. Existing tenders are preserved. Use{' '}
                      <span className="font-semibold">Run sync</span> or wait for the next
                      scheduled run.
                    </p>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs">
                  <Link
                    href="/admin/operations"
                    onClick={() => onModuleNav('/admin/operations', 'Operations')}
                    className="font-medium text-brand-800 hover:underline"
                  >
                    Automation runs (operations)
                  </Link>
                  <Link
                    href="/api/health/firestore"
                    className="font-medium text-slate-600 hover:text-brand-800"
                  >
                    Firestore health
                  </Link>
                  <Link
                    href="/api/sync/status"
                    className="font-medium text-slate-600 hover:text-brand-800"
                  >
                    Sync status JSON
                  </Link>
                </div>
              </div>

              <AdminFeatureFlagsReadOnly />
            </div>
          )}

          {tab === 'modules' && (
            <nav aria-label="All admin modules" className="space-y-6">
              {moduleGroups.map((group) => (
                <div key={group.id}>
                  <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                    {group.label}
                  </h2>
                  <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
                    {group.links.map((link) => (
                      <li key={link.href}>
                        <Link
                          href={link.href}
                          onClick={() => onModuleNav(link.href, link.label)}
                          className="flex min-h-[52px] items-center justify-between gap-3 px-4 py-3 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-800"
                        >
                          <span>
                            <span
                              className={`block text-sm font-semibold ${
                                link.accent ? 'text-brand-800' : 'text-brand-900'
                              }`}
                            >
                              {link.label}
                            </span>
                            {link.description ? (
                              <span className="block text-xs text-slate-500">
                                {link.description}
                              </span>
                            ) : null}
                          </span>
                          <ArrowTopRightOnSquareIcon
                            className="h-4 w-4 shrink-0 text-slate-400"
                            aria-hidden
                          />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          )}
        </div>
      </section>
    </div>
  )
}
