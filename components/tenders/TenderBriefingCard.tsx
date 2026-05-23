'use client'

import Link from 'next/link'
import type { TenderBriefing } from '@/lib/tenderBriefing/types'
import {
  CalendarIcon,
  MapPinIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline'

export default function TenderBriefingCard({ tender }: { tender: TenderBriefing }) {
  return (
    <article className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {tender.briefingCompulsory && (
              <span className="text-xs font-semibold px-2 py-1 rounded-full bg-red-100 text-red-700">
                Compulsory briefing
              </span>
            )}
            <span className="text-xs px-2 py-1 rounded-full bg-purple-50 text-purple-700">
              {tender.industrySector}
            </span>
            <span className="text-xs text-gray-500">Score: {tender.opportunityScore}</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900">{tender.title}</h3>
          <p className="text-sm text-gray-600 mt-1">{tender.department}</p>
          <p className="text-sm text-gray-500 mt-2 line-clamp-2">
            {tender.summary || tender.description}
          </p>
          <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-600">
            {tender.province && (
              <span className="inline-flex items-center gap-1">
                <MapPinIcon className="h-4 w-4" />
                {tender.province}
              </span>
            )}
            {tender.briefingDate && (
              <span className="inline-flex items-center gap-1">
                <CalendarIcon className="h-4 w-4" />
                Briefing: {tender.briefingDate}
              </span>
            )}
            {tender.closingDate && (
              <span className="inline-flex items-center gap-1">
                <CalendarIcon className="h-4 w-4" />
                Closes: {tender.closingDate}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <Link
            href={`/tenders/${tender.id}`}
            className="px-4 py-2 text-center rounded-xl border border-purple-200 text-purple-700 hover:bg-purple-50 text-sm font-medium"
          >
            View details
          </Link>
          {tender.briefingCompulsory && (
            <Link
              href={`/tenders/${tender.id}/request-agent`}
              className="px-4 py-2 text-center rounded-xl bg-brand-600 text-white hover:bg-brand-700 text-sm font-medium inline-flex items-center justify-center gap-1"
            >
              <SparklesIcon className="h-4 w-4" />
              Request Youth Agent
            </Link>
          )}
        </div>
      </div>
    </article>
  )
}
