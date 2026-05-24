'use client'

import type { UserProfile } from '@/lib/auth'
import {
  AgentVerificationBadge,
  NewAgentBadge,
  ReliableAgentBadge,
} from '@/components/procurement/StatusBadges'
import {
  agentTrustDefaults,
  computeAttendanceRate,
  isNewAgent,
  isReliableAgent,
} from '@/lib/procurement/agentReputation'
import { Shield, Star, CheckCircle, XCircle } from 'lucide-react'

export { agentTrustDefaults }

export default function AgentTrustIndicators({
  profile,
  compact = false,
}: {
  profile: UserProfile | null
  compact?: boolean
}) {
  const trust = agentTrustDefaults(profile)
  const attendanceRate = computeAttendanceRate(trust)

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <AgentVerificationBadge status={trust.verificationStatus} />
        {isNewAgent(trust) && <NewAgentBadge />}
        {isReliableAgent(trust) && <ReliableAgentBadge />}
        <span className="text-xs font-medium text-slate-600">
          Reliability {trust.reliabilityScore}%
        </span>
      </div>
    )
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          Agent reliability
        </h2>
        <div className="flex flex-wrap gap-2">
          <AgentVerificationBadge status={trust.verificationStatus} />
          {isNewAgent(trust) && <NewAgentBadge />}
          {isReliableAgent(trust) && <ReliableAgentBadge />}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={Star} label="Reliability Score" value={`${trust.reliabilityScore}%`} />
        <Stat icon={CheckCircle} label="Completed Briefings" value={trust.completedBriefingCount} />
        <Stat icon={Shield} label="Accepted Briefings" value={trust.acceptedBriefingCount} />
        <Stat icon={XCircle} label="Missed Briefings" value={trust.missedBriefingCount} />
      </div>
      {attendanceRate !== null && (
        <p className="mt-3 text-sm text-slate-600">
          Attendance rate: <span className="font-semibold text-slate-900">{attendanceRate}%</span>
        </p>
      )}
    </section>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Star
  label: string
  value: string | number
}) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
      <Icon className="h-4 w-4 text-brand-600" aria-hidden />
      <p className="mt-2 text-xl font-bold tabular-nums text-slate-900">{value}</p>
      <p className="text-xs font-medium text-slate-600">{label}</p>
    </div>
  )
}
