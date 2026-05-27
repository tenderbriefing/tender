import type { Metadata } from 'next'
import JsonLd from '@/components/seo/JsonLd'
import { buildPageMetadata } from '@/lib/seo/metadata'
import { getPublicTenderById } from '@/lib/seo/publicTenders'
import {
  buildTenderBreadcrumbJsonLd,
  buildTenderEventJsonLd,
  buildTenderMetadata,
} from '@/lib/seo/tenderSeo'

export async function generateMetadata({
  params,
}: {
  params: { id: string }
}): Promise<Metadata> {
  const tender = await getPublicTenderById(params.id)
  if (!tender) {
    return buildPageMetadata({
      title: 'Tender opportunity not found',
      description: 'This tender briefing may have been removed from the official eTenders feed.',
      path: `/tenders/${params.id}`,
      noIndex: true,
    })
  }
  return buildTenderMetadata(tender)
}

export default async function TenderDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { id: string }
}) {
  const tender = await getPublicTenderById(params.id)

  return (
    <>
      {tender && (
        <>
          <JsonLd data={buildTenderBreadcrumbJsonLd(tender)} />
          {tender.briefingDate ? <JsonLd data={buildTenderEventJsonLd(tender)} /> : null}
        </>
      )}
      {children}
    </>
  )
}
