import type { Metadata } from 'next'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import JsonLd from '@/components/seo/JsonLd'
import { buildPageMetadata } from '@/lib/seo/metadata'
import {
  listIndexableOrganisationEntries,
  shouldShowOrganisationDirectory,
} from '@/lib/seo/organisationHubServer'
import {
  organisationDirectoryDescription,
  organisationDirectoryPath,
  organisationDirectoryTitle,
  organisationHubPath,
} from '@/lib/seo/organisationHubs'
import {
  breadcrumbJsonLd,
  collectionPageJsonLd,
  itemListJsonLd,
} from '@/lib/seo/structuredData'

/**
 * Force-dynamic keeps directory HTTP status/metadata aligned with the live
 * indexability scan (and sitemap). Avoid ISR soft-404 caching when the
 * directory falls below the indexable-hub minimum.
 */
export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const show = await shouldShowOrganisationDirectory()
  return buildPageMetadata({
    title: organisationDirectoryTitle(),
    description: organisationDirectoryDescription(),
    path: organisationDirectoryPath(),
    noIndex: !show,
    noIndexFollow: !show,
    keywords: [
      'tenders by organisation',
      'compulsory briefing tenders South Africa',
      'government tender briefings',
    ],
  })
}

export default async function OrganisationDirectoryPage() {
  const show = await shouldShowOrganisationDirectory()
  const entries = show ? await listIndexableOrganisationEntries() : []
  const path = organisationDirectoryPath()
  const title = organisationDirectoryTitle()
  const intro = organisationDirectoryDescription()

  const breadcrumbs = breadcrumbJsonLd([
    { name: 'Home', path: '/' },
    { name: 'Tenders', path: '/tenders' },
    { name: 'Organisations', path },
  ])
  const collection = collectionPageJsonLd({
    name: title,
    description: intro,
    path,
  })
  const items =
    entries.length > 0
      ? itemListJsonLd(
          entries.map((entry) => ({
            name: organisationHubTitleSafe(entry.shortName),
            path: organisationHubPath(entry.slug),
          }))
        )
      : null

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
            <li className="font-semibold text-slate-900" aria-current="page">
              Organisations
            </li>
          </ol>
        </nav>
        <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight text-brand-900 sm:text-4xl">
            {title}
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-slate-700">{intro}</p>
          {show && entries.length > 0 ? (
            <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {entries.map((entry) => (
                <li key={entry.slug}>
                  <Link
                    href={organisationHubPath(entry.slug)}
                    className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-200 hover:bg-brand-50/40"
                  >
                    <span className="text-base font-semibold text-brand-900">
                      {entry.shortName}
                    </span>
                    <span className="mt-1 block text-sm text-slate-600">
                      {entry.displayName}
                    </span>
                    <span className="mt-3 block text-sm font-semibold text-brand-800">
                      Compulsory briefings →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-10 max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 text-base leading-relaxed text-slate-700">
              Organisation hubs appear here once enough organisations currently meet
              TenderBriefing&apos;s compulsory-briefing indexability threshold. Browse
              province and period hubs from the{' '}
              <Link
                href="/compulsory-tender-briefings"
                className="font-semibold text-brand-800 hover:underline"
              >
                compulsory tender briefings
              </Link>{' '}
              landing page, or view{' '}
              <Link href="/tenders" className="font-semibold text-brand-800 hover:underline">
                all live tenders
              </Link>
              .
            </p>
          )}
        </main>
        <Footer />
      </div>
    </>
  )
}

function organisationHubTitleSafe(shortName: string) {
  return `${shortName} Tenders with Compulsory Briefings`
}
