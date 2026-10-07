import { Suspense } from 'react'
import type { Metadata } from 'next'
import TenderCatalogueStaticList from '@/components/tenders/TenderCatalogueStaticList'
import TenderOpportunitiesClient from '@/components/tenders/TenderOpportunitiesClient'
import TenderTableSkeleton from '@/components/ui/TenderTableSkeleton'
import { getCatalogueInitialPage } from '@/lib/seo/catalogueServerData'
import { normalizeTenderSearchQuery } from '@/lib/procurement/tenderSearch'
import { buildPageMetadata } from '@/lib/seo/metadata'

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || ''
  return value || ''
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const params = (await searchParams) || {}
  const q = normalizeTenderSearchQuery(firstParam(params.q))
  const province = normalizeTenderSearchQuery(firstParam(params.province))
  const isSearch = Boolean(q || province)

  return buildPageMetadata({
    title: isSearch
      ? 'Search Tender Briefings | TenderBriefing'
      : 'Tender Briefings South Africa | Compulsory Government Tenders',
    description:
      'Browse compulsory government tender briefings across South Africa. Official eTenders data, briefing dates, documents and free SME discovery on TenderBriefing.',
    path: '/tenders',
    // Search/filter query URLs must not compete with canonical catalogue SEO.
    noIndex: isSearch,
    noIndexFollow: isSearch,
    keywords: [
      'tender briefing South Africa',
      'compulsory tender briefings',
      'government tenders',
      'eTenders opportunities',
      'SME tenders',
    ],
  })
}

export default async function TenderOpportunitiesPage() {
  const initial = await getCatalogueInitialPage()

  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 py-10">
          <TenderTableSkeleton rows={12} />
        </div>
      }
    >
      <TenderOpportunitiesClient
        initial={initial}
        ssrList={<TenderCatalogueStaticList tenders={initial.tenders} />}
      />
    </Suspense>
  )
}
