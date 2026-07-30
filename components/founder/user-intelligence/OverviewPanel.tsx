'use client'

import {
  BuildingOffice2Icon,
  UserGroupIcon,
} from '@heroicons/react/24/outline'
import {
  ComparisonBars,
  DonutChart,
  EngagementBadge,
  HorizontalBarList,
  ProgressRing,
  engagementSegments,
  formatCount,
} from './charts'
import { Panel, StatCard } from './chrome'
import type { OverviewData } from './types'

export function OverviewPanel({ overview, dataNotes }: { overview: OverviewData; dataNotes?: string[] }) {
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

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total registered" value={overview.totalRegistered} accent="navy" />
        <StatCard label="SMEs" value={overview.totalSmes} accent="navy" />
        <StatCard label="Youth Agents" value={overview.totalYouthAgents} accent="gold" />
        <StatCard
          label="Inactive / at risk"
          value={overview.inactiveUsers}
          hint="Dormant or at-risk across both roles"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel
          title="Role mix"
          subtitle="SMEs and Youth Agents stay separate"
          icon={<BuildingOffice2Icon className="h-5 w-5 text-brand-700" />}
        >
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-around">
            <DonutChart
              segments={roleSegments}
              centerLabel={formatCount(roleTotal)}
              centerSub="users"
            />
            <ul className="space-y-2 text-sm">
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

        <Panel
          title="SME vs Agent"
          subtitle="Side-by-side activity snapshot"
          icon={<UserGroupIcon className="h-5 w-5 text-accent-600" />}
        >
          <ComparisonBars items={comparisons} />
        </Panel>

        <Panel title="Onboarding completion" subtitle="Profile completion rates by role">
          <div className="flex justify-around gap-4 py-2">
            <ProgressRing
              value={overview.registrationCompletionRate?.smes}
              label="SME onboarding"
            />
            <ProgressRing
              value={overview.registrationCompletionRate?.agents}
              label="Agent onboarding"
            />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Avg days · SME
              </p>
              <p className="mt-1 text-lg font-bold tabular-nums text-brand-900">
                {formatCount(overview.averageDaysOnPlatform?.smes)}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Avg days · Agent
              </p>
              <p className="mt-1 text-lg font-bold tabular-nums text-brand-900">
                {formatCount(overview.averageDaysOnPlatform?.agents)}
              </p>
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
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

      <div className="rounded-xl border border-slate-200/80 bg-white px-5 py-4 text-xs text-slate-500 shadow-sm">
        <p>
          {overview.comparisons?.note} Session duration:{' '}
          {overview.averageSessionDuration ?? 'not yet measurable'}.
        </p>
        {Array.isArray(dataNotes) && dataNotes.length > 0 && (
          <ul className="mt-2 list-disc space-y-1 pl-4">
            {dataNotes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}
      </div>
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
