'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

type Preview = {
  candidateId: string
  companyName?: string
  contactName?: string
  tenderNumber?: string
  tenderTitle?: string
  description?: string
  briefingDate?: string | null
  briefingTime?: string | null
  briefingVenue?: string | null
  priceLabel?: string
}

function AttendInner() {
  const params = useSearchParams()
  const router = useRouter()
  const token = params.get('token') || ''
  const [preview, setPreview] = useState<Preview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!token) {
      setError('Missing secure link token')
      return
    }
    fetch(`/api/sme-connect/cta?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const json = await res.json()
        if (!json.success) throw new Error(json.error || 'Invalid link')
        setPreview(json.data)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
  }, [token])

  async function confirmAndPay() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/sme-connect/cta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action: 'confirm' }),
      })
      const json = await res.json()
      if (!json.success || !json.data?.payPath) {
        throw new Error(json.error || 'Could not start checkout')
      }
      router.push(json.data.payPath)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed')
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-xl px-4 py-12">
        <h1 className="text-2xl font-semibold text-slate-900">Confirm briefing attendance</h1>
        <p className="mt-2 text-sm text-slate-600">
          Review the opportunity below, then continue to secure payment.
        </p>

        {error ? (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            {error}
          </div>
        ) : null}

        {!preview && !error ? (
          <div className="mt-10 flex justify-center">
            <LoadingSpinner size="lg" />
          </div>
        ) : null}

        {preview ? (
          <div className="mt-8 space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <Row label="Company" value={preview.companyName} />
            <Row label="Tender" value={preview.tenderNumber} />
            <Row label="Description" value={preview.description || preview.tenderTitle} />
            <Row label="Briefing date" value={preview.briefingDate || '—'} />
            <Row label="Time" value={preview.briefingTime || '—'} />
            <Row label="Venue" value={preview.briefingVenue || '—'} />
            <Row label="Price" value={preview.priceLabel || '—'} />
            <button
              type="button"
              disabled={busy}
              onClick={confirmAndPay}
              className="mt-4 w-full rounded-lg bg-brand-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {busy ? 'Starting checkout…' : 'CONFIRM & PAY'}
            </button>
          </div>
        ) : null}
      </main>
      <Footer />
    </div>
  )
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm text-slate-900">{value || '—'}</p>
    </div>
  )
}

export default function SmeConnectAttendPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      }
    >
      <AttendInner />
    </Suspense>
  )
}
