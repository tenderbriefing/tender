import Link from 'next/link'
import type { TenderBriefing } from '@/lib/tenderBriefing/types'
import { categoryBrowsePath } from '@/lib/seo/programmaticRoutes'
import { getIndexableProvinceHubHref } from '@/lib/seo/compulsoryBriefingHubServer'
import { getIndexableOrganisationHubHref } from '@/lib/seo/organisationHubServer'
import { briefingInstantInRange, getBriefingPeriodRange } from '@/lib/seo/compulsoryBriefingPeriods'
import { periodHubPath } from '@/lib/seo/compulsoryBriefingHubs'

export default async function TenderDetailContextLinks({ tender }: { tender: TenderBriefing }) {
  const [provinceHubHref, organisationHub] = await Promise.all([
    getIndexableProvinceHubHref(tender.province),
    getIndexableOrganisationHubHref(tender),
  ])
  const categoryHref = categoryBrowsePath(tender)
  const thisWeekRange = getBriefingPeriodRange('this-week')
  const showThisWeekLink = briefingInstantInRange(tender, thisWeekRange)

  return (
    <nav
      aria-label="Browse related tender categories"
      className="mt-8 rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm"
    >
      <p className="text-sm font-semibold text-brand-900">Explore similar opportunities</p>
      <ul className="mt-3 flex flex-wrap gap-3">
        <li>
          <Link
            href="/compulsory-tender-briefings"
            className="inline-flex min-h-[44px] items-center rounded-xl border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-800 hover:bg-brand-100"
          >
            Compulsory tender briefings
          </Link>
        </li>
        <li>
          <Link
            href="/tender-briefing-agent"
            className="inline-flex min-h-[44px] items-center rounded-xl border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-800 hover:bg-brand-100"
          >
            Tender briefing agent
          </Link>
        </li>
        {organisationHub ? (
          <li>
            <Link
              href={organisationHub.href}
              className="inline-flex min-h-[44px] items-center rounded-xl border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-800 hover:bg-brand-100"
            >
              More compulsory briefing tenders from {organisationHub.label}
            </Link>
          </li>
        ) : null}
        {provinceHubHref ? (
          <li>
            <Link
              href={provinceHubHref}
              className="inline-flex min-h-[44px] items-center rounded-xl border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-800 hover:bg-brand-100"
            >
              More compulsory briefings in {tender.province}
            </Link>
          </li>
        ) : null}
        {showThisWeekLink ? (
          <li>
            <Link
              href={periodHubPath('this-week')}
              className="inline-flex min-h-[44px] items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              View briefings this week
            </Link>
          </li>
        ) : null}
        {categoryHref ? (
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
