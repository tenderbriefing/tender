'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'

export default function PrivateTenderStatusPage({
  params,
}: {
  params: { token: string }
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<{
    status: string
    title: string
    tenderReference: string
    companyName: string
    submittedAt: string
    publishedTenderId: string | null
    rejectionReason: string | null
    changesRequestedNote: string | null
  } | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/private-tenders/status/${params.token}`)
        const json = await res.json()
        if (!res.ok || !json.success) throw new Error(json.error || 'Not found')
        if (!cancelled) setData(json.data)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load status')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [params.token])

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-xl px-4 py-12 sm:px-6">
        <h1 className="text-2xl font-bold text-brand-950">Submission status</h1>
        {loading && <p className="mt-4 text-sm text-slate-600">Loading…</p>}
        {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
        {data && (
          <div className="mt-6 space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
            <p className="text-lg font-bold capitalize text-brand-900">
              {String(data.status).replace(/_/g, ' ')}
            </p>
            <dl className="mt-4 space-y-2 text-sm text-slate-700">
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-500">Company</dt>
                <dd>{data.companyName}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-500">Title</dt>
                <dd>{data.title}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-500">Reference</dt>
                <dd>{data.tenderReference}</dd>
              </div>
            </dl>
            {data.rejectionReason && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
                {data.rejectionReason}
              </p>
            )}
            {data.changesRequestedNote && (
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {data.changesRequestedNote}
              </p>
            )}
            {data.publishedTenderId && (
              <Link
                href={`/tenders/${data.publishedTenderId}`}
                className="inline-flex font-semibold text-brand-800 hover:underline"
              >
                View published tender →
              </Link>
            )}
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}
