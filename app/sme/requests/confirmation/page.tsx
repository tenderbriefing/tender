'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { CheckCircle2 } from 'lucide-react'

function ConfirmationContent() {
  const searchParams = useSearchParams()
  const requestId = searchParams.get('requestId')

  return (
    <main className="mx-auto max-w-lg px-4 py-16 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-50">
        <CheckCircle2 className="h-10 w-10 text-brand-600" />
      </div>
      <h1 className="mt-6 text-2xl font-bold text-slate-900">Request submitted</h1>
      <p className="mt-3 text-slate-600 leading-relaxed">
        Your Youth Agent attendance request is pending. Nearby agents will be notified
        and the first available agent to accept will be assigned to attend your compulsory
        briefing.
      </p>
      {requestId && (
        <p className="mt-2 text-xs text-slate-400">Reference: {requestId}</p>
      )}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link
          href="/sme/requests"
          className="rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-700"
        >
          My requests
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
