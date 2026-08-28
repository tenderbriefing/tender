import Link from 'next/link'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import JsonLd from '@/components/seo/JsonLd'
import CompulsoryBriefingTenderList from '@/components/seo/CompulsoryBriefingTenderList'
import {
  breadcrumbJsonLd,
  collectionPageJsonLd,
  itemListJsonLd,
} from '@/lib/seo/structuredData'
import type { ProvinceHubData, PeriodHubData } from '@/lib/seo/compulsoryBriefingHubServer'
import {
  provinceHubCtaCopy,
} from '@/lib/seo/compulsoryBriefingHubs'
import { provinceBrowsePath } from '@/lib/seo/programmaticRoutes'
import { getOfficialEtendersScope } from '@/lib/procurement/tenderDescription'
import { BRIEFING_PERIOD_LABELS } from '@/lib/seo/compulsoryBriefingPeriods'

type ProvinceHubProps = {
  kind: 'province'
  path: string
  title: string
  intro: string
  data: ProvinceHubData
}

type PeriodHubProps = {
  kind: 'period'
  path: string
  title: string
  intro: string
  data: PeriodHubData
}

export type CompulsoryBriefingHubPageProps = ProvinceHubProps | PeriodHubProps

function tenderListItems(tenders: PeriodHubData['tenders'] | ProvinceHubData['upcoming']) {
  return tenders.slice(0, 20).map((t) => ({
    name: t.tenderNumber || getOfficialEtendersScope(t) || t.title || t.id,
    path: `/tenders/${t.id}`,
  }))
}

export default function CompulsoryBriefingHubPage(props: CompulsoryBriefingHubPageProps) {
  const provinceBrowseHref =
    props.kind === 'province'
      ? provinceBrowsePath(props.data.province) ||
        `/tenders?province=${encodeURIComponent(props.data.province)}`
      : null

  const breadcrumbs =
    props.kind === 'province'
      ? breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Tenders', path: '/tenders' },
          {
            name: props.data.province,
            path: provinceBrowseHref || props.path,
          },
          { name: 'Compulsory Briefings', path: props.path },
        ])
      : breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Compulsory Tender Briefings', path: '/compulsory-tender-briefings' },
          {
            name: BRIEFING_PERIOD_LABELS[props.data.period],
            path: props.path,
          },
        ])

  const tendersForList =
    props.kind === 'province'
      ? [...props.data.upcoming, ...props.data.historical]
      : props.data.tenders

  const collection = collectionPageJsonLd({
    name: props.title,
    description: props.intro,
    path: props.path,
  })
  const items = itemListJsonLd(tenderListItems(tendersForList))

  const empty =
    props.kind === 'province'
      ? props.data.upcoming.length === 0 && props.data.historical.length === 0
      : props.data.tenders.length === 0

  return (
    <>
      <JsonLd data={breadcrumbs} />
      <JsonLd data={collection} />
      {items ? <JsonLd data={items} /> : null}
      <div className="min-h-screen bg-slate-50">
        <Header />
        <nav
          aria-label="Breadcrumb"
          className="border-b border-slate-200 bg-white"
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
            {props.kind === 'province' ? (
              <>
                <li>
                  <Link href="/tenders" className="font-medium hover:text-brand-800">
                    Tenders
                  </Link>
                </li>
                <li aria-hidden="true" className="text-slate-400">
                  /
                </li>
                <li>
                  <Link href={provinceBrowseHref!} className="font-medium hover:text-brand-800">
                    {props.data.province}
                  </Link>
                </li>
                <li aria-hidden="true" className="text-slate-400">
                  /
                </li>
                <li className="font-semibold text-slate-900" aria-current="page">
                  Compulsory Briefings
                </li>
              </>
            ) : (
              <>
                <li>
                  <Link
                    href="/compulsory-tender-briefings"
                    className="font-medium hover:text-brand-800"
                  >
                    Compulsory Tender Briefings
                  </Link>
                </li>
                <li aria-hidden="true" className="text-slate-400">
                  /
                </li>
                <li className="font-semibold text-slate-900" aria-current="page">
                  {BRIEFING_PERIOD_LABELS[props.data.period]}
                </li>
              </>
            )}
          </ol>
        </nav>

        <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight text-brand-900 sm:text-4xl">
            {props.title}
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-slate-700">{props.intro}</p>

          {empty ? (
            <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-8 text-center">
              <p className="text-slate-700">
                {props.kind === 'period'
                  ? `No compulsory tender briefings are currently listed for ${BRIEFING_PERIOD_LABELS[props.data.period].toLowerCase()}.`
                  : `No compulsory tender briefings are currently listed for ${props.data.province}.`}
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3 text-sm font-semibold">
                <Link href="/compulsory-tender-briefings/this-week" className="text-brand-800 hover:underline">
                  This week
                </Link>
                <Link href="/compulsory-tender-briefings/next-week" className="text-brand-800 hover:underline">
                  Next week
                </Link>
                <Link href="/compulsory-tender-briefings/this-month" className="text-brand-800 hover:underline">
                  This month
                </Link>
                <Link href="/compulsory-tender-briefings" className="text-brand-800 hover:underline">
                  All compulsory briefings
                </Link>
                <Link href="/tenders" className="text-brand-800 hover:underline">
                  Browse tenders
                </Link>
              </div>
            </div>
          ) : null}

          {props.kind === 'province' ? (
            <div className="mt-10 space-y-10">
              <CompulsoryBriefingTenderList
                heading="Upcoming compulsory briefings"
                tenders={props.data.upcoming}
                linkOrganisationHubs
              />
              <CompulsoryBriefingTenderList
                heading="Recent closed compulsory briefings"
                tenders={props.data.historical}
                linkOrganisationHubs
              />
            </div>
          ) : (
            <div className="mt-10 space-y-10">
              {props.data.groupedByDate.map((group) => (
                <section key={group.ymd}>
                  <h2 className="text-lg font-bold text-brand-900">{group.dateLabel}</h2>
                  <CompulsoryBriefingTenderList tenders={group.tenders} linkOrganisationHubs />
                </section>
              ))}
            </div>
          )}

          <div className="mt-12 rounded-2xl border border-brand-100 bg-brand-50/60 p-6">
            <p className="text-sm leading-relaxed text-slate-700">{provinceHubCtaCopy()}</p>
            <Link
              href="/tender-briefing-agent"
              className="mt-4 inline-flex min-h-[44px] items-center rounded-xl bg-accent-500 px-5 py-2.5 text-sm font-bold text-brand-900"
            >
              Learn about Youth Agent attendance
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    </>
  )
}
