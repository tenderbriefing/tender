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
import type { OrganisationHubData } from '@/lib/seo/organisationHubServer'
import {
  organisationDirectoryPath,
  organisationHubCtaCopy,
} from '@/lib/seo/organisationHubs'
import { getOfficialEtendersScope } from '@/lib/procurement/tenderDescription'

export default function OrganisationCompulsoryBriefingHubPage({
  path,
  title,
  intro,
  data,
  showDirectoryLink,
}: {
  path: string
  title: string
  intro: string
  data: OrganisationHubData
  showDirectoryLink: boolean
}) {
  const breadcrumbs = breadcrumbJsonLd([
    { name: 'Home', path: '/' },
    { name: 'Tenders', path: '/tenders' },
    ...(showDirectoryLink
      ? [{ name: 'Organisations', path: organisationDirectoryPath() }]
      : []),
    { name: data.entry.shortName, path },
    { name: 'Compulsory Briefings', path },
  ])

  const tendersForList = [...data.upcoming, ...data.historical]
  const collection = collectionPageJsonLd({
    name: title,
    description: intro,
    path,
  })
  const items = itemListJsonLd(
    tendersForList.slice(0, 20).map((t) => ({
      name: t.tenderNumber || getOfficialEtendersScope(t) || t.title || t.id,
      path: `/tenders/${t.id}`,
    }))
  )

  const empty = data.upcoming.length === 0 && data.historical.length === 0

  return (
    <>
      <JsonLd data={breadcrumbs} />
      <JsonLd data={collection} />
      {items ? <JsonLd data={items} /> : null}
      <div className="min-h-screen bg-slate-50">
        <Header />
        <nav aria-label="Breadcrumb" className="border-b border-slate-200 bg-white">
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
            {showDirectoryLink ? (
              <>
                <li>
                  <Link
                    href={organisationDirectoryPath()}
                    className="font-medium hover:text-brand-800"
                  >
                    Organisations
                  </Link>
                </li>
                <li aria-hidden="true" className="text-slate-400">
                  /
                </li>
              </>
            ) : null}
            <li>
              <span className="font-medium text-slate-700">{data.entry.shortName}</span>
            </li>
            <li aria-hidden="true" className="text-slate-400">
              /
            </li>
            <li className="font-semibold text-slate-900" aria-current="page">
              Compulsory Briefings
            </li>
          </ol>
        </nav>

        <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight text-brand-900 sm:text-4xl">
            {title}
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-slate-700">{intro}</p>

          {empty ? (
            <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-8 text-center">
              <p className="text-slate-700">
                No compulsory tender briefings are currently listed for {data.entry.displayName}.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3 text-sm font-semibold">
                {showDirectoryLink ? (
                  <Link
                    href={organisationDirectoryPath()}
                    className="text-brand-800 hover:underline"
                  >
                    Browse organisations
                  </Link>
                ) : null}
                <Link href="/compulsory-tender-briefings" className="text-brand-800 hover:underline">
                  All compulsory briefings
                </Link>
                <Link href="/tenders" className="text-brand-800 hover:underline">
                  Browse tenders
                </Link>
              </div>
            </div>
          ) : null}

          <div className="mt-10 space-y-10">
            <CompulsoryBriefingTenderList
              heading="Upcoming compulsory briefings"
              tenders={data.upcoming}
            />
            <CompulsoryBriefingTenderList
              heading="Recent closed compulsory briefings"
              tenders={data.historical}
            />
          </div>

          <div className="mt-12 rounded-2xl border border-brand-100 bg-brand-50/60 p-6">
            <p className="text-sm leading-relaxed text-slate-700">{organisationHubCtaCopy()}</p>
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
