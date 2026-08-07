'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import RetryPaymentButton from '@/components/payments/RetryPaymentButton'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import {
  explainPayFastUserError,
  isPayFastSameAccountError,
  PAYFAST_SAME_ACCOUNT_HINT,
} from '@/lib/payments/payfastUserErrors'

function PaymentCancelledContent() {
  const searchParams = useSearchParams()
  const requestId = searchParams?.get('requestId') || ''
  const reason = searchParams?.get('reason') || searchParams?.get('error') || ''
  const sameAccount =
    isPayFastSameAccountError(reason) ||
    reason === 'same_account' ||
    reason === 'same-account'
  const payfastHint =
    explainPayFastUserError(reason) || (sameAccount ? PAYFAST_SAME_ACCOUNT_HINT : null)

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-lg px-4 py-12">
        <div className="rounded-2xl border border-amber-200 bg-white p-8 shadow-sm text-center">
          <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-amber-600" />
          <h1 className="mt-4 text-2xl font-bold text-slate-900">Payment not completed</h1>
          <p className="mt-2 text-slate-600">
            Your attendance request was saved, but the R249.00 support fee was not paid. Youth
            Agents will only see your request after payment is complete.
          </p>
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-950">
            <p className="font-semibold">PayFast tip</p>
            <p className="mt-1 text-amber-900/90">
              {payfastHint || PAYFAST_SAME_ACCOUNT_HINT}
            </p>
          </div>
          {requestId && (
            <div className="mt-6">
              <RetryPaymentButton requestId={requestId} className="w-full" />
            </div>
          )}
          <div className="mt-6 flex flex-col gap-3">
            {requestId && (
              <Link
                href={`/sme/requests/${requestId}`}
                className="text-sm font-semibold text-brand-700 hover:underline"
              >
                View request details
              </Link>
            )}
            <Link
              href="/sme/requests"
              className="text-sm font-semibold text-slate-600 hover:underline"
            >
              Back to My Requests
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default function PaymentCancelledPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <LoadingSpinner size="lg" />
        </div>
      }
    >
      <PaymentCancelledContent />
    </Suspense>
  )
}
