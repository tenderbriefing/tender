import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import OrganisationCompulsoryBriefingHubPage from '@/components/seo/OrganisationCompulsoryBriefingHubPage'
import { buildPageMetadata } from '@/lib/seo/metadata'
import {
  loadOrganisationHubData,
  shouldShowOrganisationDirectory,
} from '@/lib/seo/organisationHubServer'
import {
  isOrganisationHubIndexable,
  organisationHubDescription,
  organisationHubIntro,
  organisationHubPath,
  organisationHubTitle,
} from '@/lib/seo/organisationHubs'
import {
  allOrganisationSlugs,
  getOrganisationBySlug,
} from '@/lib/seo/organisationRegistry'

export const revalidate = 600

export function generateStaticParams() {
  return allOrganisationSlugs().map((organisation) => ({ organisation }))
}

export async function generateMetadata({
  params,
}: {
  params: { organisation: string }
}): Promise<Metadata> {
  const entry = getOrganisationBySlug(params.organisation)
  if (!entry) {
    return buildPageMetadata({
      title: 'Organisation not found',
      description: 'Compulsory tender briefings by organisation.',
      path: organisationHubPath(params.organisation),
      noIndex: true,
      noIndexFollow: true,
    })
  }

  const data = await loadOrganisationHubData(entry.slug)
  const indexable = data ? isOrganisationHubIndexable(data.counts) : false

  return buildPageMetadata({
    title: organisationHubTitle(entry),
    description: organisationHubDescription(entry),
    path: organisationHubPath(entry.slug),
    noIndex: !indexable,
    noIndexFollow: !indexable,
    keywords: [
      `${entry.shortName} compulsory briefing tenders`,
      `${entry.shortName} tender briefings`,
      'compulsory tender briefings South Africa',
    ],
  })
}

export default async function OrganisationCompulsoryBriefingsPage({
  params,
}: {
  params: { organisation: string }
}) {
  const data = await loadOrganisationHubData(params.organisation)
  if (!data) notFound()

  const showDirectoryLink = await shouldShowOrganisationDirectory()
  const path = organisationHubPath(data.entry.slug)

  return (
    <OrganisationCompulsoryBriefingHubPage
      path={path}
      title={organisationHubTitle(data.entry)}
      intro={organisationHubIntro(data.entry)}
      data={data}
      showDirectoryLink={showDirectoryLink}
    />
  )
}
