'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/providers/AuthProvider'
import MobileShell from '@/components/agent/mobile/MobileShell'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { mobileGet } from '@/lib/mobile/mobileApi'

type Earnings = {
  completedBriefings: number
  pendingPayoutCents: number
  paidEarningsCents: number
  monthEarningsCents: number
  payouts: Array<{ id: string; status?: string; amountCents?: number; createdAt?: string }>
}

function zar(cents: number) {
  return `R${(cents / 100).toFixed(2)}`
}

export default function AgentMobileEarningsPage() {
  const { user, userProfile, loading } = useAuth()
  const router = useRouter()
  const [data, setData] = useState<Earnings | null>(null)

  useEffect(() => {
    if (!loading && !user) router.replace('/agent/mobile/login')
    if (!loading && userProfile && userProfile.userType !== 'youth-agent') {
      router.replace('/agent/dashboard')
    }
  }, [user, userProfile, loading, router])

  useEffect(() => {
    if (!user) return
    mobileGet<Earnings>('/api/mobile/v1/earnings').then(setData).catch(() => setData(null))
  }, [user])

  if (loading || !user) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <MobileShell title="Earnings">
      {!data ? (
        <LoadingSpinner />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-xs text-slate-500">Completed</p>
              <p className="text-2xl font-bold">{data.completedBriefings}</p>
            </div>
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-xs text-slate-500">This month</p>
              <p className="text-2xl font-bold text-brand-700">{zar(data.monthEarningsCents)}</p>
            </div>
            <div className="rounded-2xl bg-amber-50 p-4">
              <p className="text-xs text-amber-800">Pending payout</p>
              <p className="text-xl font-bold text-amber-900">{zar(data.pendingPayoutCents)}</p>
            </div>
            <div className="rounded-2xl bg-emerald-50 p-4">
              <p className="text-xs text-emerald-800">Paid total</p>
              <p className="text-xl font-bold text-emerald-900">{zar(data.paidEarningsCents)}</p>
            </div>
          </div>
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="font-bold text-slate-900">Payout history</h2>
            <ul className="mt-3 space-y-2">
              {(data.payouts || []).length === 0 ? (
                <li className="text-sm text-slate-500">No payouts yet</li>
              ) : (
                data.payouts.map((p) => (
                  <li
                    key={p.id}
                    className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"
                  >
                    <span className="capitalize">{p.status}</span>
                    <span className="font-semibold">{zar(p.amountCents || 0)}</span>
                  </li>
                ))
              )}
            </ul>
          </section>
        </div>
      )}
    </MobileShell>
  )
}
