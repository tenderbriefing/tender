import Link from 'next/link'
import {
  listIndexablePeriodHubSlugs,
  listIndexableProvinceHubSlugs,
} from '@/lib/seo/compulsoryBriefingHubServer'
import { listOrganisationNavEntries } from '@/lib/seo/organisationHubServer'
import { periodHubPath, provinceHubPath } from '@/lib/seo/compulsoryBriefingHubs'
import {
  organisationDirectoryPath,
  organisationHubPath,
  ORG_DIRECTORY_MIN_INDEXABLE,
} from '@/lib/seo/organisationHubs'
import { BRIEFING_PERIOD_LABELS, type BriefingPeriodSlug } from '@/lib/seo/compulsoryBriefingPeriods'
import { PROVINCE_SLUG_TO_NAME } from '@/lib/procurement/provinces'

const PERIOD_LINK_ORDER: BriefingPeriodSlug[] = [
  'today',
  'this-week',
  'next-week',
  'this-month',
]

export default async function CompulsoryBriefingHubNav() {
  const [provinceSlugs, periodSlugs, orgEntries] = await Promise.all([
    listIndexableProvinceHubSlugs(),
    listIndexablePeriodHubSlugs(),
    listOrganisationNavEntries(),
  ])

  if (provinceSlugs.length === 0 && periodSlugs.length === 0 && orgEntries.length === 0) {
    return null
  }

  const showOrgDirectory = orgEntries.length >= ORG_DIRECTORY_MIN_INDEXABLE

  return (
    <section className="mt-14 rounded-3xl border border-brand-200 bg-gradient-to-br from-brand-50/70 to-white p-6 sm:p-8">
      <h2 className="font-display text-2xl font-bold text-brand-900">
        Browse compulsory tender briefings
      </h2>
      {provinceSlugs.length > 0 ? (
        <div className="mt-6">
          <h3 className="text-sm font-bold uppercase tracking-wide text-brand-800">
            By province
          </h3>
          <ul className="mt-3 flex flex-wrap gap-2">
            {provinceSlugs.map((slug) => {
              const province = PROVINCE_SLUG_TO_NAME[slug]
              return (
                <li key={slug}>
                  <Link
                    href={provinceHubPath(slug)}
                    className="inline-flex min-h-[44px] items-center rounded-full border border-brand-100 bg-white px-4 py-2 text-sm font-semibold text-brand-800 hover:bg-brand-50"
                  >
                    {province}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
      {periodSlugs.length > 0 ? (
        <div className="mt-8">
          <h3 className="text-sm font-bold uppercase tracking-wide text-brand-800">By date</h3>
          <ul className="mt-3 flex flex-wrap gap-2">
            {PERIOD_LINK_ORDER.filter((period) => periodSlugs.includes(period)).map((period) => (
              <li key={period}>
                <Link
                  href={periodHubPath(period)}
                  className="inline-flex min-h-[44px] items-center rounded-full border border-brand-100 bg-white px-4 py-2 text-sm font-semibold text-brand-800 hover:bg-brand-50"
                >
                  {BRIEFING_PERIOD_LABELS[period]}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {orgEntries.length > 0 ? (
        <div className="mt-8">
          <h3 className="text-sm font-bold uppercase tracking-wide text-brand-800">
            By organisation
          </h3>
          <ul className="mt-3 flex flex-wrap gap-2">
            {orgEntries.map((entry) => (
              <li key={entry.slug}>
                <Link
                  href={organisationHubPath(entry.slug)}
                  className="inline-flex min-h-[44px] items-center rounded-full border border-brand-100 bg-white px-4 py-2 text-sm font-semibold text-brand-800 hover:bg-brand-50"
                >
                  {entry.shortName}
                </Link>
              </li>
            ))}
            {showOrgDirectory ? (
              <li>
                <Link
                  href={organisationDirectoryPath()}
                  className="inline-flex min-h-[44px] items-center rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white"
                >
                  All organisations
                </Link>
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
