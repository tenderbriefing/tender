'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowPathIcon,
  ArrowRightIcon,
  ChartBarIcon,
  ClipboardDocumentListIcon,
  InboxIcon,
  PaperAirplaneIcon,
  Squares2X2Icon,
  UserGroupIcon,
} from '@heroicons/react/24/outline'
import { FounderShell } from '@/components/founder/FounderShell'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { authFetch } from '@/lib/api/authenticatedFetch'
import { formatCount, PriorityBadge } from '@/components/founder/user-intelligence/charts'
import type {
  ActionItem,
  IntelligencePayload,
  OverviewData,
} from '@/components/founder/user-intelligence/types'

const SHORTCUTS = [
  {
    href: '/founder/user-intelligence',
    label: 'User Intelligence',
    description: 'SME and Youth Agent cohorts',
    icon: ChartBarIcon,
  },
  {
    href: '/admin/registrations',
    label: 'Registrations',
    description: 'Directory of SMEs and agents',
    icon: UserGroupIcon,
  },
  {
    href: '/admin/operations',
    label: 'Assignments',
    description: 'Attendance and dispatch queue',
    icon: ClipboardDocumentListIcon,
  },
  {
    href: '/admin/procurement-inbox',
    label: 'RFQ inbox',
    description: 'Procurement email ingestion',
    icon: InboxIcon,
  },
  {
    href: '/admin/dispatch',
    label: 'Dispatch',
    description: 'Assign agents to briefings',
    icon: PaperAirplaneIcon,
  },
  {
    href: '/admin/dashboard',
    label: 'Console',
    description: 'Sync health and ops modules',
    icon: Squares2X2Icon,
  },
] as const

export default function LegacyFounderHomePage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [actions, setActions] = useState<ActionItem[]>([])
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await authFetch('/api/founder/user-intelligence?page=1&pageSize=1')
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to load founder snapshot')
      }
      const payload = json.data as IntelligencePayload
      setOverview(payload.overview || null)
      setActions(payload.actions || [])
      setGeneratedAt(payload.generatedAt || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const generatedLabel = useMemo(() => {
    if (!generatedAt) return null
    try {
      return new Date(generatedAt).toLocaleString('en-ZA')
    } catch {
      return null
    }
  }, [generatedAt])

  const topActions = useMemo(() => {
    const weight: Record<string, number> = { high: 3, medium: 2, low: 1 }
    return [...actions]
      .sort(
        (a, b) =>
          (weight[b.priority] || 0) - (weight[a.priority] || 0) ||
          (b.affectedCount || 0) - (a.affectedCount || 0)
      )
      .slice(0, 3)
  }, [actions])

  const kpis = overview
    ? [
        { label: 'Registered', value: overview.totalRegistered },
        { label: 'SMEs', value: overview.totalSmes },
        { label: 'Youth Agents', value: overview.totalYouthAgents },
        {
          label: 'Active today',
          value: (overview.activeSmesToday || 0) + (overview.activeYouthAgentsToday || 0),
          hint: `${formatCount(overview.activeSmesToday)} SME · ${formatCount(overview.activeYouthAgentsToday)} agent`,
        },
        {
          label: 'New today',
          value: (overview.newSmesToday || 0) + (overview.newYouthAgentsToday || 0),
          hint: `${formatCount(overview.newSmesToday)} SME · ${formatCount(overview.newYouthAgentsToday)} agent`,
        },
        {
          label: 'At risk',
          value: overview.inactiveUsers,
          warn: (overview.inactiveUsers || 0) > 0,
        },
      ]
    : []

  return (
    <FounderShell
      title="Home"
      subtitle="Platform pulse and daily work — open User Intelligence when you need depth."
      actions={
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-brand-800 transition hover:bg-slate-50 disabled:opacity-50"
        >
          <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      }
    >
      {loading && !overview ? (
        <div className="flex flex-col items-center justify-center gap-3 py-24">
          <LoadingSpinner size="lg" />
          <p className="text-sm text-slate-500">Loading snapshot…</p>
        </div>
      ) : error && !overview ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-900">
          <p className="font-semibold">Could not load founder snapshot</p>
          <p className="mt-1">{error}</p>
          <button
            type="button"
            onClick={load}
            className="mt-3 font-semibold underline underline-offset-2"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {generatedLabel ? (
            <p className="text-xs tabular-nums text-slate-400">Snapshot · {generatedLabel}</p>
          ) : null}

          <section aria-label="Platform pulse" className="rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
              <h2 className="text-sm font-semibold text-brand-900">Platform pulse</h2>
            </div>
            <dl className="grid grid-cols-2 divide-y divide-slate-100 sm:grid-cols-3 lg:grid-cols-6 lg:divide-y-0">
              {kpis.map((kpi) => (
                <div
                  key={kpi.label}
                  className="px-4 py-4 sm:px-5 lg:border-l lg:border-slate-100 lg:first:border-l-0"
                >
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    {kpi.label}
                  </dt>
                  <dd
                    className={`mt-1 text-2xl font-semibold tabular-nums tracking-tight ${
                      'warn' in kpi && kpi.warn ? 'text-amber-800' : 'text-brand-900'
                    }`}
                  >
                    {formatCount(kpi.value)}
                  </dd>
                  {'hint' in kpi && kpi.hint ? (
                    <p className="mt-0.5 text-[11px] text-slate-500">{kpi.hint}</p>
                  ) : null}
                </div>
              ))}
            </dl>
          </section>

          <section aria-label="Needs attention" className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <h2 className="text-sm font-semibold text-brand-900">Needs attention</h2>
              <Link
                href="/founder/user-intelligence?tab=actions"
                className="inline-flex items-center gap-1 text-sm font-semibold text-brand-800 hover:underline"
              >
                All actions
                <ArrowRightIcon className="h-3.5 w-3.5" />
              </Link>
            </div>

            {topActions.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
                No intervention prompts right now.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
                {topActions.map((a) => (
                  <li key={a.id} className="px-4 py-4 sm:px-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <PriorityBadge priority={a.priority} />
                      <span className="text-xs tabular-nums text-slate-500">
                        {a.affectedCount.toLocaleString('en-ZA')} affected
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-brand-900">{a.title}</p>
                    <p className="mt-1 text-sm text-slate-600 line-clamp-2">{a.suggestedAction}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-label="Go to" className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <h2 className="text-sm font-semibold text-brand-900">Go to</h2>
              <Link
                href="/founder/user-intelligence"
                className="inline-flex items-center gap-1 text-sm font-semibold text-brand-800 hover:underline"
              >
                Full intelligence
                <ArrowRightIcon className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {SHORTCUTS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group flex min-h-[72px] items-start gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3.5 transition hover:border-brand-300 hover:bg-brand-50/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-800"
                >
                  <item.icon className="mt-0.5 h-5 w-5 shrink-0 text-brand-800" aria-hidden />
                  <span>
                    <span className="block text-sm font-semibold text-brand-900 group-hover:text-brand-800">
                      {item.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">{item.description}</span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        </div>
      )}
    </FounderShell>
  )
}
