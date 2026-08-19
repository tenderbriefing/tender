'use client'

import { useState } from 'react'
import { FounderShell } from '@/components/founder/FounderShell'
import { useFounderDashboard } from '@/components/founder/v2/useFounderDashboard'
import {
  ActivityChart,
  ErrorState,
  KpiStrip,
  LoadingState,
  NeedsAttention,
  PeriodPicker,
} from '@/components/founder/v2/ui'
import {
  formatZarFromCents,
  periodLabel,
  type FounderDashboardPeriod,
} from '@/lib/founder/dashboard'

export default function FounderOverviewPage() {
  const [period, setPeriod] = useState<FounderDashboardPeriod>('30')
  const { loading, error, data, reload } = useFounderDashboard({
    view: 'overview',
    period,
  })
  const overview = data?.overview

  const kpis = overview
    ? [
        { label: 'SMEs', value: overview.kpis.smes.toLocaleString('en-ZA') },
        { label: 'Youth Agents', value: overview.kpis.youthAgents.toLocaleString('en-ZA') },
        {
          label: 'Paid Bookings',
          value: overview.kpis.paidBookings.toLocaleString('en-ZA'),
        },
        { label: 'Revenue', value: formatZarFromCents(overview.kpis.revenueCents) },
        {
          label: 'Upcoming Briefings',
          value: overview.kpis.upcomingBriefings.toLocaleString('en-ZA'),
        },
        {
          label: 'Completed Briefings',
          value: overview.kpis.completedBriefings.toLocaleString('en-ZA'),
        },
      ]
    : []

  return (
    <FounderShell
      title="Overview"
      subtitle={`How the business stands · ${periodLabel(period)}`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <PeriodPicker value={period} onChange={(v) => setPeriod(v as FounderDashboardPeriod)} />
          <button
            type="button"
            onClick={reload}
            disabled={loading}
            className="min-h-[36px] rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-brand-800 disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
      }
    >
      {loading && !overview ? (
        <LoadingState label="Loading overview…" />
      ) : error && !overview ? (
        <ErrorState message={error} onRetry={reload} />
      ) : overview ? (
        <div className="space-y-8">
          <KpiStrip items={kpis} />
          <ActivityChart points={overview.activity} />
          <NeedsAttention items={overview.needsAttention} />
        </div>
      ) : (
        <ErrorState message="Overview data unavailable" onRetry={reload} />
      )}
    </FounderShell>
  )
}
