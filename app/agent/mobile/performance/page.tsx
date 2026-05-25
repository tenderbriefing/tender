'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/providers/AuthProvider'
import MobileShell from '@/components/agent/mobile/MobileShell'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { mobileGet } from '@/lib/mobile/mobileApi'

type Performance = {
  tier: string
  performanceScore: number
  reliabilityScore: number
  attendancePct: number
  missedBriefings: number
  reportQuality: number
  fraudFlags: number
  latenessPct: number
}

const TIER_STYLES: Record<string, string> = {
  Platinum: 'bg-violet-100 text-violet-900',
  Gold: 'bg-amber-100 text-amber-900',
  Silver: 'bg-slate-100 text-slate-800',
  'At Risk': 'bg-red-100 text-red-900',
}

export default function AgentMobilePerformancePage() {
  const { user, userProfile, loading } = useAuth()
  const router = useRouter()
  const [data, setData] = useState<Performance | null>(null)

  useEffect(() => {
    if (!loading && !user) router.replace('/agent/mobile/login')
    if (!loading && userProfile && userProfile.userType !== 'youth-agent') {
      router.replace('/agent/dashboard')
    }
  }, [user, userProfile, loading, router])

  useEffect(() => {
    if (!user) return
    mobileGet<Performance>('/api/mobile/v1/performance').then(setData).catch(() => setData(null))
  }, [user])

  if (loading || !user) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  const tierClass = TIER_STYLES[data?.tier || 'Silver'] || TIER_STYLES.Silver

  return (
    <MobileShell title="Performance">
      {!data ? (
        <LoadingSpinner />
      ) : (
        <div className="space-y-4">
          <div className={`rounded-2xl p-6 text-center ${tierClass}`}>
            <p className="text-sm font-semibold uppercase">Tier</p>
            <p className="text-3xl font-black">{data.tier}</p>
            <p className="mt-2 text-sm">Reliability {data.reliabilityScore}%</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              ['Attendance', `${data.attendancePct}%`],
              ['Report quality', `${data.reportQuality}%`],
              ['Performance score', String(data.performanceScore)],
              ['Lateness', `${data.latenessPct}%`],
              ['Missed briefings', String(data.missedBriefings)],
              ['Fraud flags', String(data.fraudFlags)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-white p-3 shadow-sm">
                <p className="text-xs text-slate-500">{label}</p>
                <p className="text-lg font-bold text-slate-900">{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </MobileShell>
  )
}
