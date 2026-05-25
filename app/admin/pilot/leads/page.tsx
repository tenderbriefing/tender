'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import PilotLeadManager from '@/components/admin/PilotLeadManager'
import ProcurementPageHeader from '@/components/procurement/ProcurementPageHeader'
import { useAuth } from '@/components/providers/AuthProvider'

export default function AdminPilotLeadsPage() {
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
      <ProcurementPageHeader
        kicker="Pilot CRM"
        title="Lead manager"
        description="Track SME and Youth Agent prospects, log WhatsApp outreach, and move leads through the pilot funnel."
        breadcrumb={{ label: 'Pilot', href: '/admin/pilot' }}
      />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <PilotLeadManager />
      </main>
      <Footer />
    </div>
  )
}
