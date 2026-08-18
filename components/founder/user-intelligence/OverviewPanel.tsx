'use client'

import {
  ComparisonBars,
  DonutChart,
  EngagementBadge,
  HorizontalBarList,
  ProgressRing,
  engagementSegments,
  formatCount,
} from './charts'
import { Panel } from './chrome'
import type { OverviewData } from './types'

export function OverviewPanel({
  overview,
  dataNotes,
}: {
  overview: OverviewData
  dataNotes?: string[]
}) {
  const smeEngagement = engagementSegments(overview.engagementDistribution?.smes)
  const agentEngagement = engagementSegments(overview.engagementDistribution?.agents)
  const roleTotal = (overview.totalSmes || 0) + (overview.totalYouthAgents || 0)

  const roleSegments = [
    {
      key: 'sme',
      label: 'SMEs',
      value: overview.totalSmes || 0,
      color: '#0F1E3D',
    },
    {
      key: 'agent',
      label: 'Youth Agents',
      value: overview.totalYouthAgents || 0,
      color: '#D4AF37',
    },
  ]

  const comparisons = [
    {
      label: 'Registered',
      sme: overview.totalSmes || 0,
      agent: overview.totalYouthAgents || 0,
    },
    {
      label: 'New today',
      sme: overview.newSmesToday || 0,
      agent: overview.newYouthAgentsToday || 0,
    },
    {
      label: 'Active today',
      sme: overview.activeSmesToday || 0,
      agent: overview.activeYouthAgentsToday || 0,
    },
  ]

  const pulse = [
    { label: 'Total registered', value: overview.totalRegistered },
    { label: 'SMEs', value: overview.totalSmes },
    { label: 'Youth Agents', value: overview.totalYouthAgents },
    {
      label: 'Inactive / at risk',
      value: overview.inactiveUsers,
      warn: true,
      hint: 'Dormant or at-risk across both roles',
    },
  ]

  return (
    <div className="space-y-6">
      <section aria-label="Key metrics" className="rounded-lg border border-slate-200 bg-white">
        <dl className="grid grid-cols-2 divide-y divide-slate-100 lg:grid-cols-4 lg:divide-y-0">
          {pulse.map((kpi) => (
            <div
              key={kpi.label}
              className="px-4 py-4 sm:px-5 lg:border-l lg:border-slate-100 lg:first:border-l-0"
            >
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {kpi.label}
              </dt>
              <dd
                className={`mt-1 text-2xl font-semibold tabular-nums tracking-tight ${
                  kpi.warn && (kpi.value || 0) > 0 ? 'text-amber-800' : 'text-brand-900'
                }`}
              >
                {formatCount(kpi.value)}
              </dd>
              {kpi.hint ? <p className="mt-0.5 text-[11px] text-slate-500">{kpi.hint}</p> : null}
            </div>
          ))}
        </dl>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Role mix" subtitle="SMEs and Youth Agents stay separate">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-around">
            <DonutChart
              segments={roleSegments}
              centerLabel={formatCount(roleTotal)}
              centerSub="users"
            />
            <ul className="w-full space-y-2 text-sm sm:w-auto">
              {roleSegments.map((s) => (
                <li key={s.key} className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="text-slate-600">{s.label}</span>
                  <span className="ml-auto font-semibold tabular-nums text-brand-900">
                    {formatCount(s.value)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Panel>

        <Panel title="SME vs Agent" subtitle="Side-by-side activity">
          <ComparisonBars items={comparisons} />
        </Panel>

        <Panel title="Onboarding" subtitle="Profile completion by role">
          <div className="flex justify-around gap-4 py-2">
            <ProgressRing
              value={overview.registrationCompletionRate?.smes}
              label="SME"
            />
            <ProgressRing
              value={overview.registrationCompletionRate?.agents}
              label="Agent"
            />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Avg days · SME
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-brand-900">
                {formatCount(overview.averageDaysOnPlatform?.smes)}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Avg days · Agent
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-brand-900">
                {formatCount(overview.averageDaysOnPlatform?.agents)}
              </p>
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="SME engagement" subtitle="Distribution across engagement classes">
          <EngagementDistribution segments={smeEngagement} empty="No SME engagement data yet" />
        </Panel>
        <Panel title="Youth Agent engagement" subtitle="Distribution across engagement classes">
          <EngagementDistribution
            segments={agentEngagement}
            empty="No Youth Agent engagement data yet"
          />
        </Panel>
      </div>

      <p className="text-xs leading-relaxed text-slate-500">
        {overview.comparisons?.note} Session duration:{' '}
        {overview.averageSessionDuration ?? 'not yet measurable'}.
        {Array.isArray(dataNotes) && dataNotes.length > 0
          ? ` ${dataNotes.join(' ')}`
          : null}
      </p>
    </div>
  )
}

function EngagementDistribution({
  segments,
  empty,
}: {
  segments: ReturnType<typeof engagementSegments>
  empty: string
}) {
  const total = segments.reduce((s, x) => s + x.value, 0)
  if (total === 0) {
    return <p className="py-8 text-center text-sm text-slate-500">{empty}</p>
  }

  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
      <DonutChart
        segments={segments}
        size={132}
        thickness={16}
        centerLabel={formatCount(total)}
        centerSub="users"
      />
      <div className="min-w-0 flex-1">
        <HorizontalBarList
          rows={segments.map((s) => ({ label: s.label, value: s.value, color: s.color }))}
          color="#0F1E3D"
          max={Math.max(...segments.map((s) => s.value), 1)}
        />
        <div className="mt-3 flex flex-wrap gap-1.5">
          {segments.map((s) => (
            <EngagementBadge key={s.key} value={s.key} />
          ))}
        </div>
      </div>
    </div>
  )
}
