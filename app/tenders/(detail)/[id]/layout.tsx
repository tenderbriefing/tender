import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import JsonLd from '@/components/seo/JsonLd'
import { buildPageMetadata } from '@/lib/seo/metadata'
import { getIndexableTenderById } from '@/lib/seo/publicTenders'
import {
  buildTenderBreadcrumbJsonLd,
  buildTenderBriefingEventJsonLd,
  buildTenderMetadata,
  buildTenderWebPageJsonLd,
  tenderHasUsefulHistoricalContent,
} from '@/lib/seo/tenderSeo'

export async function generateMetadata(
  props: {
    params: Promise<{ id: string }>
  }
): Promise<Metadata> {
  const params = await props.params;
  const tender = await getIndexableTenderById(params.id)
  if (!tender || !tenderHasUsefulHistoricalContent(tender)) {
    return buildPageMetadata({
      title: 'Tender opportunity not found',
      description: 'This tender briefing may have been removed from the official eTenders feed.',
      path: `/tenders/${params.id}`,
      noIndex: true,
    })
  }
  return buildTenderMetadata(tender)
}

export default async function TenderDetailLayout(
  props: {
    children: React.ReactNode
    params: Promise<{ id: string }>
  }
) {
  const params = await props.params;

  const {
    children
  } = props;

  const tender = await getIndexableTenderById(params.id)
  if (!tender || !tenderHasUsefulHistoricalContent(tender)) notFound()

  const briefingEvent = buildTenderBriefingEventJsonLd(tender)

  return (
    <>
      <JsonLd data={buildTenderBreadcrumbJsonLd(tender)} />
      <JsonLd data={buildTenderWebPageJsonLd(tender)} />
      {briefingEvent ? <JsonLd data={briefingEvent} /> : null}
      {children}
    </>
  )
}
