'use client'

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
import LoadingSpinner from '@/components/ui/LoadingSpinner'

interface DashboardKpiGridProps {
  userType?: UserProfile['userType']
  metrics: DashboardMetrics | null
  loading?: boolean
}

export default function DashboardKpiGrid({
  userType,
  metrics,
  loading,
}: DashboardKpiGridProps) {
  if (loading && !metrics) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner />
      </div>
    )
  }

  if (userType === 'youth-agent' && metrics?.role === 'youth-agent') {
    const kpis = [
      {
        icon: Briefcase,
        label: 'Available Assignments',
        value: metrics.availableAssignments,
        hint: 'Open briefing jobs',
      },
      {
        icon: Calendar,
        label: 'Assigned Briefings',
        value: metrics.assignedBriefings,
        hint: 'Your active assignments',
      },
      {
        icon: CheckCircle,
        label: 'Completed Reports',
        value: metrics.completedReports,
        hint: 'Submitted to SMEs',
      },
      {
        icon: TrendingUp,
        label: 'Reliability Score',
        value: `${metrics.reliabilityScore}%`,
        hint: `${metrics.missedBriefings} missed · ${metrics.acceptedBriefings} accepted`,
      },
    ]
    return <KpiLayout kpis={kpis} />
  }

  if (userType === 'admin' && metrics?.role === 'admin') {
    const kpis = [
      { icon: Briefcase, label: 'Total Tenders', value: metrics.totalTenders, hint: 'Live sync' },
      {
        icon: AlertTriangle,
        label: 'Compulsory Briefings',
        value: metrics.compulsoryBriefings,
        hint: 'Requires attendance',
      },
      {
        icon: Clock,
        label: 'Pending Requests',
        value: metrics.pendingRequests,
        hint: 'Awaiting assignment',
      },
      {
        icon: Users,
        label: 'Active Agents',
        value: metrics.activeAgents,
        hint: `${metrics.activeSmes} SMEs active`,
      },
    ]
    return <KpiLayout kpis={kpis} />
  }

  if (metrics?.role === 'sme') {
    const kpis = [
      {
        icon: Briefcase,
        label: 'Active Opportunities',
        value: metrics.activeOpportunities,
        hint: 'From official data',
      },
      {
        icon: Bell,
        label: 'Attendance Requests',
        value: metrics.attendanceRequests,
        hint: `${metrics.pendingAttendance} pending`,
      },
      {
        icon: Calendar,
        label: 'Upcoming Briefings',
        value: metrics.upcomingBriefings,
        hint: 'This week',
      },
      {
        icon: TrendingUp,
        label: 'Closing Soon',
        value: metrics.closingSoon,
        hint: `${metrics.completedReports} reports received`,
      },
    ]
    return <KpiLayout kpis={kpis} />
  }

  return null
}

function KpiLayout({
  kpis,
}: {
  kpis: Array<{
    icon: typeof Briefcase
    label: string
    value: string | number
    hint: string
  }>
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {kpis.map((kpi) => (
        <div
          key={kpi.label}
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-600">{kpi.label}</p>
            <kpi.icon className="h-5 w-5 text-brand-600" aria-hidden />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">{kpi.value}</p>
          <p className="mt-1 text-xs text-slate-500">{kpi.hint}</p>
        </div>
      ))}
    </div>
  )
}
