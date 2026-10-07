'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { useAuth } from '@/components/providers/AuthProvider'
import { authFetch } from '@/lib/api/authenticatedFetch'
import { signInWithReturnHref } from '@/lib/auth/safeReturnPath'
import type { EnrichedAttendanceRequest } from '@/lib/tenderBriefing/enrichment'
import { CheckCircleIcon } from '@heroicons/react/24/outline'

function PaymentSuccessContent() {
  const searchParams = useSearchParams()
  const requestId = searchParams?.get('requestId') || ''
  const { user, userProfile, loading: authLoading } = useAuth()
  const router = useRouter()
  const [request, setRequest] = useState<EnrichedAttendanceRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("We're confirming your payment…")
  const [paidConfirmed, setPaidConfirmed] = useState(false)

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        const returnPath = requestId
          ? `/sme/requests/payment-success?requestId=${encodeURIComponent(requestId)}`
          : '/sme/requests/payment-success'
        router.push(signInWithReturnHref(returnPath))
      } else if (userProfile?.userType !== 'sme') {
        router.push('/dashboard')
      }
    }
  }, [authLoading, user, userProfile, router, requestId])

  useEffect(() => {
    if (!requestId || !user) return

    let cancelled = false
    let attempts = 0

    const confirm = async () => {
      try {
        await authFetch('/api/payments/payfast/confirm', {
          method: 'POST',
          body: JSON.stringify({ requestId }),
        })
        const res = await authFetch(`/api/attendance-requests/${requestId}`)
        const json = await res.json()
        if (cancelled) return
        if (json.success) {
          setRequest(json.data.request)
          if (json.data.request.paymentStatus === 'paid') {
            setPaidConfirmed(true)
            setMessage(
              'Payment received. Your booking is confirmed — nearby Youth Agents can now accept it.'
            )
            setLoading(false)
            return
          }
          setMessage(
            "We're confirming your payment with the bank. This usually takes a few seconds."
          )
        }
      } catch {
        if (!cancelled) {
          setMessage('We could not verify payment yet. Check My Requests for status.')
        }
      }

      attempts += 1
      if (!cancelled && attempts < 8) {
        window.setTimeout(confirm, 2500)
      } else if (!cancelled) {
        setLoading(false)
        setMessage(
          'Payment is still processing. Open My Requests shortly — confirmation is server-side and does not rely on this page.'
        )
      }
    }

    void confirm()
    return () => {
      cancelled = true
    }
  }, [requestId, user])

  if (authLoading || (loading && !request)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center px-4">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-sm font-medium text-slate-700">{message}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-lg px-4 py-12">
        <div className="rounded-2xl border border-accent-200 bg-white p-8 shadow-sm text-center">
          <CheckCircleIcon
            className={`mx-auto h-12 w-12 ${paidConfirmed ? 'text-accent-500' : 'text-slate-300'}`}
          />
          <h1 className="mt-4 text-2xl font-bold text-slate-900">
            {paidConfirmed ? 'Booking confirmed' : 'Confirming payment'}
          </h1>
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
              View this booking
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
