import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import CompulsoryBriefingHubPage from '@/components/seo/CompulsoryBriefingHubPage'
import { buildPageMetadata } from '@/lib/seo/metadata'
import { loadProvinceHubData } from '@/lib/seo/compulsoryBriefingHubServer'
import { listIndexableOrganisationHubSlugs } from '@/lib/seo/organisationHubServer'
import {
  isProvinceHubIndexable,
  provinceHubDescription,
  provinceHubIntro,
  provinceHubPath,
  provinceHubTitle,
  resolveProvinceSlug,
} from '@/lib/seo/compulsoryBriefingHubs'

export const PROVINCE_HUB_REVALIDATE = 600

export function createProvinceCompulsoryBriefingsPage(slug: string) {
  async function generateMetadata(): Promise<Metadata> {
    const province = resolveProvinceSlug(slug)
    if (!province) {
      return buildPageMetadata({
        title: 'Province not found',
        description: 'Compulsory tender briefings by province.',
        path: provinceHubPath(slug),
        noIndex: true,
        noIndexFollow: true,
      })
    }

    const data = await loadProvinceHubData(province, slug)
    const indexable = isProvinceHubIndexable(data.counts)

    return buildPageMetadata({
      title: provinceHubTitle(province),
      description: provinceHubDescription(province),
      path: provinceHubPath(slug),
      noIndex: !indexable,
      noIndexFollow: !indexable,
      keywords: [
        `compulsory tender briefings ${province}`,
        'tender briefing South Africa',
        province,
      ],
    })
  }

  async function Page() {
    const province = resolveProvinceSlug(slug)
    if (!province) notFound()

    const [data, indexableOrganisationSlugs] = await Promise.all([
      loadProvinceHubData(province, slug),
      listIndexableOrganisationHubSlugs(),
    ])
    const path = provinceHubPath(slug)

    return (
      <CompulsoryBriefingHubPage
        kind="province"
        path={path}
        title={provinceHubTitle(province)}
        intro={provinceHubIntro(province)}
        data={data}
        indexableOrganisationSlugs={indexableOrganisationSlugs}
      />
    )
  }

  return { generateMetadata, default: Page, revalidate: PROVINCE_HUB_REVALIDATE }
}
