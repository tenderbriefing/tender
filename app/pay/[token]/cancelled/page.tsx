'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'

export default function ManualPayCancelledPage() {
  const params = useParams()
  const token = String(params?.token || '')

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-xl px-4 py-12 sm:px-6">
        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">
            TenderBriefing
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">Payment cancelled</h1>
          <p className="mt-3 text-sm text-slate-600">
            No payment was taken. Your invoice remains unpaid. You can retry whenever you are ready.
          </p>
          <Link
            href={`/pay/${encodeURIComponent(token)}`}
            className="mt-6 inline-block rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
          >
            Return to payment page
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  )
}
