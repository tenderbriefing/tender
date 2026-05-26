'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import TenderDetailView from '@/components/procurement/TenderDetailView'
import { TrustStrip } from '@/components/procurement/TrustDisclaimer'
import type { TenderBriefing } from '@/lib/tenderBriefing/types'

export default function TenderDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const [tender, setTender] = useState<TenderBriefing | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    const load = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/tender-briefings/${id}`)
        const json = await res.json()
        if (json.success) setTender(json.data)
        else setTender(null)
      } finally {
        setLoading(false)
      }
    }
    load()
    const interval = setInterval(load, 60000)
    return () => clearInterval(interval)
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-emerald-50/30">
        <Header />
        <div className="flex items-center justify-center py-32">
          <LoadingSpinner size="lg" />
        </div>
        <Footer />
      </div>
    )
  }

  if (!tender) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-emerald-50/30">
        <Header />
        <main className="max-w-3xl mx-auto px-4 py-16 text-center">
          <p className="text-slate-600">Tender opportunity not found.</p>
          <Link href="/tenders" className="text-brand-700 mt-4 inline-block font-semibold">
            Back to Tender Opportunities
          </Link>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-emerald-50/30">
      <Header />
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-2 sm:px-6 lg:px-8">
          <TrustStrip />
        </div>
      </div>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <TenderDetailView tender={tender} />
      </main>
      <Footer />
    </div>
  )
}
