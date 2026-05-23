'use client'

import type { UserProfile } from '@/lib/auth'
import { AgentVerificationBadge } from '@/components/procurement/StatusBadges'
import { Shield, Star, CheckCircle, XCircle } from 'lucide-react'

export function agentTrustDefaults(profile: UserProfile | null) {
  return {
    verificationStatus: profile?.verificationStatus ?? 'pending',
    reliabilityScore: profile?.reliabilityScore ?? 100,
    completedBriefingCount: profile?.completedBriefingCount ?? 0,
    acceptedBriefingCount: profile?.acceptedBriefingCount ?? 0,
    missedBriefingCount: profile?.missedBriefingCount ?? 0,
  }
}

export default function AgentTrustIndicators({
  profile,
  compact = false,
}: {
  profile: UserProfile | null
  compact?: boolean
}) {
  const trust = agentTrustDefaults(profile)

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <AgentVerificationBadge status={trust.verificationStatus} />
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
        <AgentVerificationBadge status={trust.verificationStatus} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          icon={Star}
          label="Reliability Score"
          value={`${trust.reliabilityScore}%`}
        />
        <Stat
          icon={CheckCircle}
          label="Completed Briefings"
          value={trust.completedBriefingCount}
        />
        <Stat
          icon={Shield}
          label="Accepted Briefings"
          value={trust.acceptedBriefingCount}
        />
        <Stat
          icon={XCircle}
          label="Missed Briefings"
          value={trust.missedBriefingCount}
        />
      </div>
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
      <p className="mt-2 text-xl font-bold text-slate-900">{value}</p>
      <p className="text-xs font-medium text-slate-600">{label}</p>
    </div>
  )
}
