'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { startPayFastFromApiPayload } from '@/lib/payments/payfastClient'
import toast from 'react-hot-toast'

type PublicPayment = {
  bookingId: string
  invoiceNumber: string | null
  invoiceStatus: string
  paymentStatus: string
  companyName: string
  customerEmail: string
  tenderReference: string
  tenderDescription: string
  briefingDate: string
  briefingTime: string
  briefingVenue: string
  amountCents: number
  amountLabel: string
  alreadyPaid: boolean
}

export default function ManualPayPage() {
  const params = useParams()
  const token = String(params?.token || '')
  const [booking, setBooking] = useState<PublicPayment | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [paying, setPaying] = useState(false)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await fetch(`/api/pay/${encodeURIComponent(token)}`)
      const json = await res.json()
      if (!json.success) {
        setError(json.error || 'Payment link not found')
        setBooking(null)
        return
      }
      setBooking(json.data)
      setError(null)
    } catch {
      setError('Could not load payment details')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  async function payNow() {
    if (!token || paying) return
    setPaying(true)
    try {
      const res = await fetch(`/api/pay/${encodeURIComponent(token)}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const json = await res.json()
      if (!json.success) {
        toast.error(json.error || 'Could not start PayFast checkout')
        return
      }
      if (json.data.alreadyPaid) {
        toast.success('This invoice is already paid')
        await load()
        return
      }
      startPayFastFromApiPayload(json.data)
    } catch {
      toast.error('Could not start payment')
    } finally {
      setPaying(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        {loading ? (
          <div className="flex justify-center py-20">
            <LoadingSpinner size="lg" />
          </div>
        ) : error || !booking ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <h1 className="text-xl font-semibold text-slate-900">Payment link unavailable</h1>
            <p className="mt-2 text-slate-600">{error || 'This secure link is invalid or expired.'}</p>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">
              TenderBriefing
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">
              Tender Briefing Attendance Service
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Pay securely for Youth Agent attendance. You do not need to find this tender on
              TenderBriefing.
            </p>

            <dl className="mt-8 space-y-3 text-sm">
              <div className="flex justify-between gap-4 border-b border-slate-100 pb-2">
                <dt className="text-slate-500">Tender / RFQ reference</dt>
                <dd className="font-medium text-slate-900 text-right">{booking.tenderReference}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-slate-100 pb-2">
                <dt className="text-slate-500">Company</dt>
                <dd className="font-medium text-slate-900 text-right">{booking.companyName}</dd>
              </div>
              {booking.briefingDate || booking.briefingVenue ? (
                <div className="flex justify-between gap-4 border-b border-slate-100 pb-2">
                  <dt className="text-slate-500">Briefing details</dt>
                  <dd className="font-medium text-slate-900 text-right">
                    {[booking.briefingDate, booking.briefingTime, booking.briefingVenue]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-4 border-b border-slate-100 pb-2">
                <dt className="text-slate-500">Service fee</dt>
                <dd className="font-medium text-slate-900">{booking.amountLabel}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-base font-semibold text-slate-900">Total</dt>
                <dd className="text-base font-semibold text-brand-700">{booking.amountLabel}</dd>
              </div>
            </dl>

            <p className="mt-6 text-xs text-slate-500">
              Payment confirms the booking of a TenderBriefing Youth Agent, subject to agent
              availability and the briefing information supplied. TenderBriefing is not VAT
              registered.
            </p>

            {booking.alreadyPaid ? (
              <div className="mt-6 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
                This invoice is PAID. Thank you — we will assign a Youth Agent.
              </div>
            ) : (
              <button
                type="button"
                onClick={payNow}
                disabled={paying}
                className="mt-6 w-full rounded-lg bg-brand-700 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
              >
                {paying ? 'Starting PayFast…' : 'Pay securely with PayFast'}
              </button>
            )}

            <a
              href={`/api/pay/${encodeURIComponent(token)}/invoice`}
              className="mt-4 block text-center text-sm font-medium text-slate-600 hover:text-brand-700"
            >
              Download invoice PDF
            </a>
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}
