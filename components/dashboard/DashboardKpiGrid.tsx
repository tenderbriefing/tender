'use client'

import type { LucideIcon } from 'lucide-react'
import {
  Bell,
  Briefcase,
  Calendar,
  TrendingUp,
  Users,
  CheckCircle,
  Clock,
  AlertTriangle,
} from 'lucide-react'
import type { UserProfile } from '@/lib/auth'
import type { DashboardMetrics } from '@/hooks/useDashboardMetrics'
import { SkeletonStatsRow } from '@/components/ui/Skeleton'

interface DashboardKpiGridProps {
  userType?: UserProfile['userType']
  metrics: DashboardMetrics | null
  loading?: boolean
}

type KpiTone = 'navy' | 'gold' | 'neutral' | 'highlight'

interface KpiItem {
  icon: LucideIcon
  label: string
  value: string | number
  hint: string
  tone: KpiTone
}

export default function DashboardKpiGrid({
  userType,
  metrics,
  loading,
}: DashboardKpiGridProps) {
  if (loading && !metrics) {
    return <SkeletonStatsRow count={4} />
  }

  if (userType === 'youth-agent' && metrics?.role === 'youth-agent') {
    const kpis: KpiItem[] = [
      {
        icon: Briefcase,
        label: 'Available Assignments',
        value: metrics.availableAssignments,
        hint: 'Open briefing jobs in your area',
        tone: 'highlight',
      },
      {
        icon: Calendar,
        label: 'Assigned Briefings',
        value: metrics.assignedBriefings,
        hint: 'Your active assignments',
        tone: 'navy',
      },
      {
        icon: CheckCircle,
        label: 'Completed Reports',
        value: metrics.completedReports,
        hint: 'Submitted to SMEs',
        tone: 'neutral',
      },
      {
        icon: TrendingUp,
        label: 'Reliability Score',
        value: `${metrics.reliabilityScore}%`,
        hint: `${metrics.missedBriefings} missed · ${metrics.acceptedBriefings} accepted`,
        tone: 'gold',
      },
    ]
    return <KpiLayout kpis={kpis} />
  }

  if (userType === 'admin' && metrics?.role === 'admin') {
    const kpis: KpiItem[] = [
      { icon: Briefcase, label: 'Total Tenders', value: metrics.totalTenders, hint: 'Live sync', tone: 'navy' },
      {
        icon: AlertTriangle,
        label: 'Compulsory Briefings',
        value: metrics.compulsoryBriefings,
        hint: 'Requires attendance',
        tone: 'gold',
      },
      {
        icon: Clock,
        label: 'Pending Requests',
        value: metrics.pendingRequests,
        hint: 'Awaiting assignment',
        tone: 'highlight',
      },
      {
        icon: Users,
        label: 'Active Agents',
        value: metrics.activeAgents,
        hint: `${metrics.activeSmes} SMEs active`,
        tone: 'neutral',
      },
    ]
    return <KpiLayout kpis={kpis} />
  }

  if (metrics?.role === 'sme') {
    const kpis: KpiItem[] = [
      {
        icon: Briefcase,
        label: 'Active Opportunities',
        value: metrics.activeOpportunities,
        hint: 'From official data',
        tone: 'navy',
      },
      {
        icon: Bell,
        label: 'Attendance Requests',
        value: metrics.attendanceRequests,
        hint: `${metrics.pendingAttendance} pending`,
        tone: 'highlight',
      },
      {
        icon: Calendar,
        label: 'Upcoming Briefings',
        value: metrics.upcomingBriefings,
        hint: 'This week',
        tone: 'gold',
      },
      {
        icon: TrendingUp,
        label: 'Closing Soon',
        value: metrics.closingSoon,
        hint: `${metrics.completedReports} reports received`,
        tone: 'neutral',
      },
    ]
    return <KpiLayout kpis={kpis} />
  }

  return null
}

function KpiLayout({ kpis }: { kpis: KpiItem[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {kpis.map((kpi) => (
        <KpiCard key={kpi.label} {...kpi} />
      ))}
    </div>
  )
}

function KpiCard({ icon: Icon, label, value, hint, tone }: KpiItem) {
  const toneStyles = {
    navy: {
      card: 'border-brand-200 bg-gradient-to-br from-brand-50 via-white to-white',
      icon: 'bg-brand-900 text-accent-400 ring-brand-800',
      value: 'text-brand-900',
    },
    gold: {
      card: 'border-accent-200 bg-gradient-to-br from-accent-50 via-white to-white',
      icon: 'bg-accent-500 text-brand-900 ring-accent-300',
      value: 'text-brand-900',
    },
    highlight: {
      card: 'border-brand-700 bg-gradient-to-br from-brand-900 to-brand-800 text-white',
      icon: 'bg-accent-500 text-brand-900 ring-accent-400',
      value: 'text-white',
    },
    neutral: {
      card: 'border-slate-200 bg-white',
      icon: 'bg-brand-50 text-brand-800 ring-brand-100',
      value: 'text-brand-900',
    },
  }[tone]

  const labelClass =
    tone === 'highlight' ? 'text-brand-100/70' : 'text-slate-500'
  const hintClass =
    tone === 'highlight' ? 'text-brand-100/60' : 'text-slate-500'

  return (
    <article
      className={`group relative overflow-hidden rounded-2xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-card ${toneStyles.card}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p
            className={`text-[10px] font-bold uppercase tracking-[0.18em] ${labelClass}`}
          >
            {label}
          </p>
          <p className={`mt-3 text-3xl font-bold tracking-tight ${toneStyles.value}`}>{value}</p>
        </div>
        <span
          className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${toneStyles.icon}`}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </span>
      </div>
      <p className={`mt-3 text-xs ${hintClass}`}>{hint}</p>
    </article>
  )
}
