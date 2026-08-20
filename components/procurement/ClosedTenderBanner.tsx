import Link from 'next/link'
import { ArrowRight, History } from 'lucide-react'
import { formatProcurementDateTime } from '@/lib/procurement/dates'
import { getOfficialEtendersScope } from '@/lib/procurement/tenderDescription'
import { getTenderDisplayStatus } from '@/lib/procurement/tenderStatus'
import type { TenderBriefing } from '@/lib/tenderBriefing/types'

export default function ClosedTenderBanner({ tender }: { tender: TenderBriefing }) {
  if (getTenderDisplayStatus(tender) !== 'closed') return null

  return (
    <section
      aria-label="Tender closed"
      className="border-b border-amber-200 bg-amber-50"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div className="flex items-start gap-3">
          <History className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-amber-950">Tender closed</p>
            <p className="mt-0.5 text-sm text-amber-900/90">
              This compulsory briefing has passed
              {tender.briefingDate
                ? ` (${formatProcurementDateTime(tender.briefingDate, tender.briefingTime)})`
                : ''}
              . The record is preserved for procurement intelligence. Browse active opportunities below.
            </p>
          </div>
        </div>
        <Link
          href="/tenders"
          className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-brand-800 hover:text-accent-700"
        >
          Latest opportunities
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </section>
  )
}
