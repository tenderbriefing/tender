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
import AgentTrustIndicators from '@/components/operations/AgentTrustIndicators'
import { ArrowRight, MapPin } from 'lucide-react'

export default function AgentDashboardPage() {
  const { user, userProfile, loading } = useAuth()
  const router = useRouter()
  const { metrics, loading: metricsLoading } = useDashboardMetrics(Boolean(user))

  useEffect(() => {
    if (!loading && !user) router.push('/auth/signin')
    if (!loading && userProfile && userProfile.userType !== 'youth-agent') {
      router.push(userProfile.userType === 'sme' ? '/sme/dashboard' : '/admin/dashboard')
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
          <AgentTrustIndicators profile={userProfile} />
        </div>

        <div className="mt-8">
          <DashboardKpiGrid
            userType="youth-agent"
            metrics={metrics}
            loading={metricsLoading}
          />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Available Briefing Assignments</h2>
            <p className="mt-2 text-sm text-slate-600">
              Accept compulsory briefing sessions, submit Attendance Proof, and deliver Briefing
              Reports for SMEs.
            </p>
            <Link
              href="/jobs"
              className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
            >
              View assignments
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 text-brand-700">
              <MapPin className="h-5 w-5" />
              <h2 className="text-lg font-bold text-slate-900">Nearby briefings</h2>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              Opportunities are matched based on your profile location and availability.
              Keep your profile updated for the best assignments.
            </p>
            <Link
              href="/profile"
              className="mt-4 inline-flex text-sm font-semibold text-brand-700 hover:text-brand-800"
            >
              Update profile →
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
