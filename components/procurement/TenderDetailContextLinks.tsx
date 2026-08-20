import Link from 'next/link'
import type { TenderBriefing } from '@/lib/tenderBriefing/types'
import { categoryBrowsePath, provinceBrowsePath } from '@/lib/seo/programmaticRoutes'

export default function TenderDetailContextLinks({ tender }: { tender: TenderBriefing }) {
  const provinceHref = provinceBrowsePath(tender.province)
  const categoryHref = categoryBrowsePath(tender)

  if (!provinceHref && !categoryHref) return null

  return (
    <nav
      aria-label="Browse related tender categories"
      className="mt-8 rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm"
    >
      <p className="text-sm font-semibold text-brand-900">Explore similar opportunities</p>
      <ul className="mt-3 flex flex-wrap gap-3">
        {provinceHref ? (
          <li>
            <Link
              href={provinceHref}
              className="inline-flex min-h-[44px] items-center rounded-xl border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-800 hover:bg-brand-100"
            >
              {tender.province} tenders
            </Link>
          </li>
        ) : null}
        {categoryHref && categoryHref !== provinceHref ? (
          <li>
            <Link
              href={categoryHref}
              className="inline-flex min-h-[44px] items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Browse related category
            </Link>
          </li>
        ) : null}
        <li>
          <Link
            href="/tenders"
            className="inline-flex min-h-[44px] items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            All live tenders
          </Link>
        </li>
      </ul>
    </nav>
  )
}
