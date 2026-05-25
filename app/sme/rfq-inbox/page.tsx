'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import SmeRfqInboxPanel from '@/components/sme/SmeRfqInboxPanel'
import { useAuth } from '@/components/providers/AuthProvider'

export default function SmeRfqInboxPage() {
  const { user, userProfile, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) router.push('/auth/signin?redirect=/sme/rfq-inbox')
    if (!loading && userProfile && userProfile.userType !== 'sme') {
      router.push('/dashboard')
    }
  }, [user, userProfile, loading, router])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!user || userProfile?.userType !== 'sme') return null

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <SmeRfqInboxPanel />
      </main>
      <Footer />
    </div>
  )
}
