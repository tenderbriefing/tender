'use client'

import { useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/providers/AuthProvider'
import { auth } from '@/lib/firebase'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import DashboardWelcome from '@/components/dashboard/DashboardWelcome'
import DashboardKpiGrid from '@/components/dashboard/DashboardKpiGrid'
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics'
import RecentActivity from '@/components/dashboard/RecentActivity'
import QuickActions from '@/components/dashboard/QuickActions'
import { TrustStrip } from '@/components/procurement/TrustDisclaimer'
import SmeProcurementWorkspace from '@/components/sme/SmeProcurementWorkspace'
import SmeHowItWorksCard from '@/components/sme/SmeHowItWorksCard'

const CalendarIntegration = dynamic(
  () => import('@/components/dashboard/CalendarIntegration'),
  {
    loading: () => (
      <div className="h-48 animate-pulse rounded-xl border border-slate-200 bg-slate-50" />
    ),
  }
)

export default function SmeDashboardPage() {
  const { user, userProfile, loading } = useAuth()
  const router = useRouter()
  const { metrics, loading: metricsLoading } = useDashboardMetrics(Boolean(user))

  useEffect(() => {
    if (loading) return
    const sessionUser = user ?? auth.currentUser
    if (!sessionUser) {
      router.replace('/auth/signin')
      return
    }
    if (
      userProfile &&
      userProfile.userType !== 'sme' &&
      userProfile.userType !== 'admin'
    ) {
      router.replace(
        userProfile.userType === 'youth-agent' ? '/agent/dashboard' : '/dashboard'
      )
    }
  }, [user, userProfile, loading, router])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  const sessionUser = user ?? auth.currentUser
  if (!sessionUser) return null

  return (
    <div className="procurement-shell">
      <Header />
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-2 sm:px-6 lg:px-8">
          <TrustStrip />
        </div>
      </div>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <DashboardWelcome userProfile={userProfile} email={sessionUser.email} />

        <div className="mt-6">
          <SmeHowItWorksCard />
        </div>

        <div className="mt-8">
          <DashboardKpiGrid userType="sme" metrics={metrics} loading={metricsLoading} />
        </div>

        <div className="mt-8">
          <CalendarIntegration userType="sme" userEmail={sessionUser.email || undefined} />
        </div>

        <div className="mt-8">
          <SmeProcurementWorkspace />
        </div>

        <div className="mt-8">
          <QuickActions userType="sme" />
        </div>
        <div className="mt-8">
          <RecentActivity userType="sme" />
        </div>
      </main>
      <Footer />
    </div>
  )
}
