'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import PilotFeedbackForm from '@/components/pilot/PilotFeedbackForm'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { useAuth } from '@/components/providers/AuthProvider'

export default function FeedbackSmePage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) router.push('/auth/signin?redirect=/feedback/sme')
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-12">
        <h1 className="text-center text-2xl font-bold text-slate-900">SME pilot feedback</h1>
        <p className="mt-2 text-center text-sm text-slate-600">
          Help us improve briefing support, reports, and platform usability.
        </p>
        <div className="mt-8">
          <PilotFeedbackForm type="sme" />
        </div>
      </main>
      <Footer />
    </div>
  )
}
