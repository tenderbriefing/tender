'use client'

import { useEffect } from 'react'
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
import CalendarIntegration from '@/components/dashboard/CalendarIntegration'
import { TrustStrip } from '@/components/procurement/TrustDisclaimer'
import SmeProcurementWorkspace from '@/components/sme/SmeProcurementWorkspace'
import OperationalIntelligencePanel from '@/components/procurement/OperationalIntelligencePanel'
import { useOperationalIntelligence } from '@/hooks/useOperationalIntelligence'

export default function SmeDashboardPage() {
  const { user, userProfile, loading } = useAuth()
  const router = useRouter()
  const { metrics, loading: metricsLoading } = useDashboardMetrics(Boolean(user))
  const { data: intelligence, loading: intelligenceLoading } = useOperationalIntelligence()

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
          <TrustStrip lastSync={intelligence?.lastSync} syncHealth={intelligence?.syncHealth} />
        </div>
      </div>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <DashboardWelcome userProfile={userProfile} email={sessionUser.email} />

        <div className="mt-6">
          <OperationalIntelligencePanel data={intelligence} loading={intelligenceLoading} compact />
        </div>

        <div className="mt-8">
          <DashboardKpiGrid userType="sme" metrics={metrics} loading={metricsLoading} />
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
        <div className="mt-8">
          <CalendarIntegration userType="sme" userEmail={sessionUser.email || undefined} />
        </div>
      </main>
      <Footer />
    </div>
  )
}
