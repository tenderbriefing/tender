'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

/**
 * Return URL UX only — never marks payment PAID.
 * Authoritative settlement is PayFast ITN (/api/webhooks/payfast).
 */
export default function ManualPaySuccessPage() {
  const params = useParams()
  const token = String(params?.token || '')
  const [status, setStatus] = useState<'pending' | 'paid' | 'unknown'>('pending')
  const [company, setCompany] = useState('')
  const [reference, setReference] = useState('')
  const [loading, setLoading] = useState(true)

  const poll = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch(`/api/pay/${encodeURIComponent(token)}`)
      const json = await res.json()
      if (!json.success) {
        setStatus('unknown')
        return
      }
      setCompany(json.data.companyName || '')
      setReference(json.data.tenderReference || '')
      if (json.data.alreadyPaid || json.data.paymentStatus === 'paid') {
        setStatus('paid')
      } else {
        setStatus('pending')
      }
    } catch {
      setStatus('unknown')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    let attempts = 0
    let timer: number | undefined
    const run = async () => {
      await poll()
      attempts += 1
      if (attempts < 10) {
        timer = window.setTimeout(run, 2500)
      }
    }
    run()
    return () => {
      if (timer) window.clearTimeout(timer)
    }
  }, [poll])

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-xl px-4 py-12 sm:px-6">
        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">
            TenderBriefing
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">Payment return</h1>
          {loading ? (
            <div className="mt-8 flex justify-center">
              <LoadingSpinner />
            </div>
          ) : status === 'paid' ? (
            <div className="mt-4 space-y-3 text-sm text-slate-700">
              <p className="rounded-lg bg-emerald-50 px-4 py-3 font-medium text-emerald-800">
                Payment confirmed. Your booking is paid.
              </p>
              <p>
                {company ? `${company} · ` : ''}
                {reference || 'Booking'}
              </p>
              <p>
                We will allocate a Youth Agent subject to availability. A confirmation email is on
                its way.
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-3 text-sm text-slate-700">
              <p>
                We are confirming your payment with PayFast. This page does not settle the booking —
                confirmation is server-side and usually takes a few seconds.
              </p>
              <p>You can safely close this tab and wait for your confirmation email.</p>
              <Link
                href={`/pay/${encodeURIComponent(token)}`}
                className="inline-block font-medium text-brand-700 hover:underline"
              >
                Back to payment page
              </Link>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
