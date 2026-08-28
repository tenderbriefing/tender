import Link from 'next/link'
import { getOfficialEtendersScope } from '@/lib/procurement/tenderDescription'
import type { TenderBriefing } from '@/lib/tenderBriefing/types'

export default function TenderBreadcrumbs({ tender }: { tender: TenderBriefing }) {
  const current =
    tender.tenderNumber?.trim() ||
    getOfficialEtendersScope(tender) ||
    tender.title?.trim() ||
    'Tender'

  return (
    <nav
      aria-label="Breadcrumb"
      className="border-b border-slate-200 bg-white/90"
    >
      <ol className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-1.5 gap-y-1 px-4 py-3 text-sm text-slate-600 sm:px-6 lg:px-8">
        <li>
          <Link href="/" className="font-medium hover:text-brand-800">
            Home
          </Link>
        </li>
        <li aria-hidden="true" className="text-slate-400">
          /
        </li>
        <li>
          <Link href="/tenders" className="font-medium hover:text-brand-800">
            Tenders
          </Link>
        </li>
        <li aria-hidden="true" className="text-slate-400">
          /
        </li>
        <li
          className="max-w-[14rem] truncate font-semibold text-slate-900 sm:max-w-md"
          aria-current="page"
        >
          {current}
        </li>
      </ol>
    </nav>
  )
}
