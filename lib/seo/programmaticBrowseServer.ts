import { getProgrammaticBrowseTenders, type CataloguePageResult } from '@/lib/seo/catalogueServerData'
import { PROGRAMMATIC_PROVINCE_BY_SLUG } from '@/lib/seo/programmaticRoutes'
import {
  buildProgrammaticMetadata,
  PROGRAMMATIC_TENDER_PAGES,
  type ProgrammaticTenderPageConfig,
} from '@/lib/seo/programmaticPages'

export async function getProgrammaticBrowseProps(
  slug: string
): Promise<{ slug: string; initial: CataloguePageResult; config: ProgrammaticTenderPageConfig } | null> {
  const config = PROGRAMMATIC_TENDER_PAGES[slug]
  if (!config) return null
  const province = PROGRAMMATIC_PROVINCE_BY_SLUG[slug]
  const initial = await getProgrammaticBrowseTenders(config.filter, { province })
  return { slug, initial, config }
}

export function programmaticBrowseMetadata(slug: string) {
  const config = PROGRAMMATIC_TENDER_PAGES[slug]
  if (!config) return null
  return buildProgrammaticMetadata(config)
}
