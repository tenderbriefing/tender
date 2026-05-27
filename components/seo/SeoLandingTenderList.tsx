'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { useTenderBriefingsPolling } from '@/hooks/useTenderBriefingsPolling'
import { formatProcurementDate, formatProcurementDateTime } from '@/lib/procurement/dates'
import { getOfficialEtendersScope } from '@/lib/procurement/tenderDescription'
import { getLandingTenderFilter } from '@/lib/seo/landingFilters'
import type { TenderBriefing } from '@/lib/tenderBriefing/types'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

interface SeoLandingTenderListProps {
  slug: string
  title: string
  intro: string
  limit?: number
  initialTenders?: TenderBriefing[]
  initialLastUpdated?: string | null
}

export default function SeoLandingTenderList({
  slug,
  title,
  intro,
  limit = 8,
  initialTenders = [],
  initialLastUpdated = null,
}: SeoLandingTenderListProps) {
  const { tenders, loading, lastUpdated } = useTenderBriefingsPolling({
    compulsoryOnly: true,
  })

  const filter = useMemo(() => getLandingTenderFilter(slug), [slug])

  const filtered = useMemo(() => {
    const source = tenders.length > 0 ? tenders : initialTenders
    return source.filter(filter).slice(0, limit)
  }, [tenders, initialTenders, filter, limit])

  const syncedAt = lastUpdated || initialLastUpdated
  const showLoading = loading && filtered.length === 0

  return (
    <section className="mt-14 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <h2 className="text-2xl font-bold text-brand-900">{title}</h2>
      <p className="mt-2 text-slate-600">{intro}</p>
      {syncedAt && (
        <p className="mt-1 text-xs text-slate-500">
          Last synced {new Date(syncedAt).toLocaleString('en-ZA')}
        </p>
      )}

      {showLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
          No matching compulsory briefings are live right now.{' '}
          <Link href="/tenders" className="font-semibold text-brand-800 hover:underline">
            Browse all tender opportunities
          </Link>{' '}
          or check back after the next eTenders sync.
        </p>
      ) : (
        <ul className="mt-8 divide-y divide-slate-100">
          {filtered.map((tender) => (
            <li key={tender.id} className="py-5 first:pt-0 last:pb-0">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-xs font-bold text-brand-800">
                    {tender.tenderNumber || 'Tender'}
                  </p>
                  <Link
                    href={`/tenders/${tender.id}`}
                    className="mt-1 block text-lg font-semibold text-brand-900 hover:text-accent-700"
                  >
                    {getOfficialEtendersScope(tender) || tender.title}
                  </Link>
                  <p className="mt-2 text-sm text-slate-600">
                    {tender.department || 'Department pending'}
                    {tender.province ? ` · ${tender.province}` : ''}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium">
                    {tender.briefingDate && (
                      <span className="rounded-full bg-accent-50 px-2.5 py-1 text-accent-800">
                        Briefing:{' '}
                        {formatProcurementDateTime(tender.briefingDate, tender.briefingTime)}
                      </span>
                    )}
                    {tender.closingDate && (
                      <span className="rounded-full bg-brand-50 px-2.5 py-1 text-brand-800">
                        Closes: {formatProcurementDate(tender.closingDate)}
                      </span>
                    )}
                    {tender.briefingCompulsory && (
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-900">
                        Compulsory briefing
                      </span>
                    )}
                  </div>
                </div>
                <Link
                  href={`/tenders/${tender.id}`}
                  className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-xl bg-brand-800 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  View tender details
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6">
        <Link
          href="/tenders"
          className="text-sm font-semibold text-brand-800 hover:text-accent-700 hover:underline"
        >
          See all compulsory briefing opportunities →
        </Link>
      </div>
    </section>
  )
}
