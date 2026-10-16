'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import OperationsDashboard from '@/components/operations/OperationsDashboard'
import OpsLifecycleBoard from '@/components/operations/OpsLifecycleBoard'
import ProcurementPageHeader from '@/components/procurement/ProcurementPageHeader'
import { TrustStrip } from '@/components/procurement/TrustDisclaimer'
import { useAuth } from '@/components/providers/AuthProvider'

export default function AdminOperationsPage() {
  const { user, userProfile, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      if (!user) router.push('/auth/signin')
      else if (userProfile?.userType !== 'admin') router.push('/dashboard')
    }
  }, [user, userProfile, loading, router])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!user || userProfile?.userType !== 'admin') return null

  return (
    <div className="procurement-shell">
      <Header />
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-2 sm:px-6 lg:px-8">
          <TrustStrip />
        </div>
      </div>
      <ProcurementPageHeader
        kicker="Administration"
        title="Operations centre"
        description="Manage briefings from payment through manual report delivery. Representatives are assigned by admin — no Youth Agent marketplace."
        breadcrumb={{ label: 'Admin dashboard', href: '/admin/dashboard' }}
      />
      <main className="mx-auto max-w-7xl space-y-10 px-4 py-8 sm:px-6 lg:px-8">
        <OpsLifecycleBoard />
        <OperationsDashboard />
      </main>
      <Footer />
    </div>
  )
}
