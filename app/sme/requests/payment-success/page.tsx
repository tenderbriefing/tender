'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { useAuth } from '@/components/providers/AuthProvider'
import { authFetch } from '@/lib/api/authenticatedFetch'
import type { EnrichedAttendanceRequest } from '@/lib/tenderBriefing/enrichment'
import { CheckCircleIcon } from '@heroicons/react/24/outline'

function PaymentSuccessContent() {
  const searchParams = useSearchParams()
  const requestId = searchParams?.get('requestId') || ''
  const { user, userProfile, loading: authLoading } = useAuth()
  const router = useRouter()
  const [request, setRequest] = useState<EnrichedAttendanceRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('Confirming your payment…')

  useEffect(() => {
    if (!authLoading) {
      if (!user) router.push('/auth/signin')
      else if (userProfile?.userType !== 'sme') router.push('/dashboard')
    }
  }, [authLoading, user, userProfile, router])

  useEffect(() => {
    if (!requestId || !user) return

    const confirm = async () => {
      try {
        await authFetch('/api/payments/yoco/confirm', {
          method: 'POST',
          body: JSON.stringify({ requestId }),
        })
        const res = await authFetch(`/api/attendance-requests/${requestId}`)
        const json = await res.json()
        if (json.success) {
          setRequest(json.data.request)
          if (json.data.request.paymentStatus === 'paid') {
            setMessage('Payment received. Youth Agents can now view your request.')
          } else {
            setMessage(
              'Payment is being processed. Refresh My Requests in a moment if status is still pending.'
            )
          }
        }
      } catch {
        setMessage('We could not verify payment yet. Check My Requests for status.')
      } finally {
        setLoading(false)
      }
    }

    confirm()
  }, [requestId, user])

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-lg px-4 py-12">
        <div className="rounded-2xl border border-accent-200 bg-white p-8 shadow-sm text-center">
          <CheckCircleIcon className="mx-auto h-12 w-12 text-accent-500" />
          <h1 className="mt-4 text-2xl font-bold text-slate-900">Payment received</h1>
          <p className="mt-2 text-slate-600">{message}</p>
          {request && (
            <dl className="mt-6 text-left text-sm space-y-2 rounded-lg bg-slate-50 p-4">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Request ID</dt>
                <dd className="font-mono text-slate-900">{request.id}</dd>
              </div>
              {request.tenderNumber && (
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Tender</dt>
                  <dd className="font-mono text-slate-900">{request.tenderNumber}</dd>
                </div>
              )}
            </dl>
          )}
          <div className="mt-8 flex flex-col gap-3">
            <Link
              href={requestId ? `/sme/requests/${requestId}` : '/sme/requests'}
              className="rounded-lg bg-brand-600 py-3 text-sm font-semibold text-white hover:bg-brand-700"
            >
              View request
            </Link>
            <Link
              href="/sme/requests"
              className="text-sm font-semibold text-brand-700 hover:underline"
            >
              My Requests
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default function PaymentSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <LoadingSpinner size="lg" />
        </div>
      }
    >
      <PaymentSuccessContent />
    </Suspense>
  )
}
