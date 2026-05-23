'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/components/providers/AuthProvider'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import DashboardWelcome from '@/components/dashboard/DashboardWelcome'
import DashboardKpiGrid from '@/components/dashboard/DashboardKpiGrid'
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics'
import RecentActivity from '@/components/dashboard/RecentActivity'
import QuickActions from '@/components/dashboard/QuickActions'
import CalendarIntegration from '@/components/dashboard/CalendarIntegration'
import { AlertCircle, ArrowRight } from 'lucide-react'

export default function SmeDashboardPage() {
  const { user, userProfile, loading } = useAuth()
  const router = useRouter()
  const { metrics, loading: metricsLoading } = useDashboardMetrics(Boolean(user))

  useEffect(() => {
    if (!loading && !user) router.push('/auth/signin')
    if (!loading && userProfile && userProfile.userType !== 'sme' && userProfile.userType !== 'admin') {
      router.push(userProfile.userType === 'youth-agent' ? '/agent/dashboard' : '/dashboard')
    }
  }, [user, userProfile, loading, router])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <DashboardWelcome userProfile={userProfile} email={user.email} />

        <div className="mt-8">
          <DashboardKpiGrid userType="sme" metrics={metrics} loading={metricsLoading} />
        </div>

        <div className="mt-8 rounded-2xl border border-amber-100 bg-amber-50/80 p-5">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
            <div className="flex-1">
              <p className="font-semibold text-amber-900">Briefing alerts</p>
              <p className="mt-1 text-sm text-amber-800">
                Compulsory briefing deadlines appear here as tenders sync from official
                government data. Check opportunities daily to stay compliant.
              </p>
              <Link
                href="/tenders"
                className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-800"
              >
                View tender opportunities
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <QuickActions userType="sme" />
        </div>
        <div className="mt-8">
          <RecentActivity userType="sme" />
        </div>
        <div className="mt-8">
          <CalendarIntegration userType="sme" userEmail={user.email || undefined} />
        </div>
      </main>
      <Footer />
    </div>
  )
}
