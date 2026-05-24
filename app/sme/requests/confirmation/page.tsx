'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { CheckCircle2 } from 'lucide-react'
import { authFetch } from '@/lib/api/authenticatedFetch'
import type { EnrichedAttendanceRequest } from '@/lib/tenderBriefing/enrichment'

function ConfirmationContent() {
  const searchParams = useSearchParams()
  const requestId = searchParams.get('requestId')
  const [request, setRequest] = useState<EnrichedAttendanceRequest | null>(null)

  useEffect(() => {
    if (!requestId) return
    authFetch(`/api/attendance-requests/${requestId}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setRequest(j.data)
      })
      .catch(() => {})
  }, [requestId])

  return (
    <main className="mx-auto max-w-lg px-4 py-16 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-50">
        <CheckCircle2 className="h-10 w-10 text-brand-600" />
      </div>
      <h1 className="mt-6 text-2xl font-bold text-slate-900">Pending Attendance</h1>
      <p className="mt-3 text-slate-600 leading-relaxed">
        Your Youth Agent attendance request has been recorded. Nearby agents are being notified.
        You will receive an update when an agent accepts the assignment.
      </p>

      {requestId && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 text-left text-sm">
          <p>
            <span className="text-slate-500">Request ID:</span>{' '}
            <span className="font-mono font-semibold">{requestId}</span>
          </p>
          {request?.tender?.tenderNumber && (
            <p className="mt-2">
              <span className="text-slate-500">Tender number:</span>{' '}
              <span className="font-mono">{request.tender.tenderNumber}</span>
            </p>
          )}
          <p className="mt-2">
            <span className="text-slate-500">Status:</span>{' '}
            <span className="font-semibold text-amber-800 capitalize">
              {request?.status || 'pending'}
            </span>
          </p>
        </div>
      )}

      <div className="mt-8 rounded-xl border border-brand-100 bg-brand-50 p-4 text-left text-sm text-slate-700">
        <p className="font-semibold text-slate-900">Next steps</p>
        <ol className="mt-2 list-decimal list-inside space-y-1">
          <li>Wait for a Youth Agent to accept your briefing assignment.</li>
          <li>Track progress in My Requests.</li>
          <li>Review the Briefing Report after the session.</li>
          <li>Complete your official tender submission before closing date.</li>
        </ol>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link
          href="/sme/requests"
          className="rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-700"
        >
          My Requests
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
