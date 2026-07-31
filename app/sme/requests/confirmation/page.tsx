'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import RetryPaymentButton from '@/components/payments/RetryPaymentButton'
import { CheckCircle2, Clock3 } from 'lucide-react'
import { authFetch } from '@/lib/api/authenticatedFetch'
import type { EnrichedAttendanceRequest } from '@/lib/tenderBriefing/enrichment'
import { ATTENDANCE_FEE_LABEL } from '@/lib/payments/attendanceFee'

function ConfirmationContent() {
  const searchParams = useSearchParams()
  const requestId = searchParams.get('requestId')
  const [request, setRequest] = useState<EnrichedAttendanceRequest | null>(null)
  const [loading, setLoading] = useState(Boolean(requestId))

  useEffect(() => {
    if (!requestId) {
      setLoading(false)
      return
    }
    authFetch(`/api/attendance-requests/${requestId}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          // API returns { request, reports } — not a bare request object
          setRequest(j.data?.request ?? (j.data?.id ? j.data : null))
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [requestId])

  const needsPayment =
    request?.paymentStatus === 'pending' ||
    request?.paymentStatus === 'failed' ||
    request?.paymentStatus === 'cancelled'
  const isPaid =
    request?.paymentStatus === 'paid' || request?.paymentStatus === 'not_required'

  return (
    <main className="mx-auto max-w-lg px-4 py-16 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-50">
        {needsPayment ? (
          <Clock3 className="h-10 w-10 text-amber-600" />
        ) : (
          <CheckCircle2 className="h-10 w-10 text-brand-600" />
        )}
      </div>

      <h1 className="mt-6 text-2xl font-bold text-slate-900">
        {needsPayment ? 'One step left — complete payment' : 'Agent booking received'}
      </h1>
      <p className="mt-3 text-slate-600 leading-relaxed">
        {needsPayment
          ? `Pay ${ATTENDANCE_FEE_LABEL} to dispatch a Youth Agent to your briefing. Agents are notified only after payment.`
          : isPaid
            ? 'Nearby Youth Agents are being notified. You will get an update when someone accepts.'
            : 'Your Youth Agent booking has been recorded. Track progress in My Requests.'}
      </p>

      {loading && (
        <div className="mt-6 flex justify-center">
          <LoadingSpinner size="sm" />
        </div>
      )}

      {requestId && !loading && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 text-left text-sm">
          <p>
            <span className="text-slate-500">Booking ID:</span>{' '}
            <span className="font-mono font-semibold">{requestId}</span>
          </p>
          {(request?.tender?.tenderNumber || request?.tenderNumber) && (
            <p className="mt-2">
              <span className="text-slate-500">Tender number:</span>{' '}
              <span className="font-mono">
                {request?.tender?.tenderNumber || request?.tenderNumber}
              </span>
            </p>
          )}
          <p className="mt-2">
            <span className="text-slate-500">Status:</span>{' '}
            <span className="font-semibold text-amber-800 capitalize">
              {request?.status || 'pending'}
            </span>
          </p>
          {request?.paymentStatus && (
            <p className="mt-2">
              <span className="text-slate-500">Payment:</span>{' '}
              <span className="font-semibold capitalize">{request.paymentStatus}</span>
            </p>
          )}
        </div>
      )}

      {needsPayment && requestId && (
        <div className="mt-6">
          <RetryPaymentButton
            requestId={requestId}
            className="inline-flex w-full min-h-[48px] items-center justify-center rounded-xl bg-accent-500 px-4 py-3 text-base font-bold text-brand-900 shadow-gold hover:bg-accent-400 disabled:opacity-50"
          />
        </div>
      )}

      <div className="mt-8 rounded-xl border border-brand-100 bg-brand-50 p-4 text-left text-sm text-slate-700">
        <p className="font-semibold text-slate-900">What happens next</p>
        <ol className="mt-2 list-decimal list-inside space-y-1">
          {needsPayment && <li>Complete payment ({ATTENDANCE_FEE_LABEL}).</li>}
          <li>A Youth Agent accepts your briefing assignment.</li>
          <li>Track progress anytime in My Requests.</li>
          <li>Review the Briefing Report after the session.</li>
          <li>Submit your tender on the official portal before closing.</li>
        </ol>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link
          href={requestId ? `/sme/requests/${requestId}` : '/sme/requests'}
          className="rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-700"
        >
          View this booking
        </Link>
        <Link
          href="/tenders"
          className="rounded-xl border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Browse more tenders
        </Link>
      </div>
    </main>
  )
}

export default function RequestConfirmationPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <Suspense fallback={<div className="py-20 text-center text-slate-500">Loading…</div>}>
        <ConfirmationContent />
      </Suspense>
      <Footer />
    </div>
  )
}
