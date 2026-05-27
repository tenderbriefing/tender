'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { FileSearch } from 'lucide-react'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import EmptyState from '@/components/ui/EmptyState'
import TenderHero from '@/components/procurement/TenderHero'
import TenderIntelligence from '@/components/procurement/TenderIntelligence'
import TenderActionPanel from '@/components/procurement/TenderActionPanel'
import { ProcurementDisclaimer } from '@/components/procurement/TrustDisclaimer'
import type { TenderBriefing } from '@/lib/tenderBriefing/types'

export default function TenderDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const [tender, setTender] = useState<TenderBriefing | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    let active = true
    const load = async () => {
      try {
        const res = await fetch(`/api/tender-briefings/${id}`)
        const json = await res.json()
        if (!active) return
        if (json.success) setTender(json.data)
        else setTender(null)
      } finally {
        if (active) setLoading(false)
      }
    }
    setLoading(true)
    load()
    const interval = setInterval(load, 60000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-brand-50/30">
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
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-brand-50/30">
        <Header />
        <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <EmptyState
            icon={FileSearch}
            title="Tender opportunity not found"
            description="It may have been removed from the official feed or the link may be incorrect. Browse all live opportunities to keep going."
            action={{ label: 'Back to Tender Opportunities', href: '/tenders' }}
          />
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-brand-50/20 pb-24 lg:pb-12">
      <Header />
      <TenderHero tender={tender} />

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <div className="grid gap-8 lg:grid-cols-[1fr,360px]">
          <TenderIntelligence tender={tender} />
          <TenderActionPanel tender={tender} />
        </div>

        <div className="mt-10 rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
          <ProcurementDisclaimer />
          <p className="mt-3 text-xs text-slate-500">
            Source: Official eTenders data ·{' '}
            <Link
              href="/tenders"
              className="font-semibold text-brand-800 hover:text-accent-600"
            >
              All tender opportunities →
            </Link>
          </p>
        </div>
      </main>

      <TenderActionPanel tender={tender} variant="mobile" />
      <Footer />
    </div>
  )
}
