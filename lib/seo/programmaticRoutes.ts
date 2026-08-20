import { PROGRAMMATIC_TENDER_PAGES, PROGRAMMATIC_SLUGS } from '@/lib/seo/programmaticPages'

/** Province slugs that map to a Firestore province equality filter. */
export const PROGRAMMATIC_PROVINCE_BY_SLUG: Record<string, string> = {
  gauteng: 'Gauteng',
  'western-cape': 'Western Cape',
  'kwazulu-natal': 'KwaZulu-Natal',
}

/** Reverse lookup: province display name → browse slug when it exists. */
export const PROVINCE_SLUG_BY_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(PROGRAMMATIC_PROVINCE_BY_SLUG).map(([slug, name]) => [name, slug])
)

export function provinceBrowsePath(province?: string | null): string | null {
  if (!province?.trim()) return null
  const slug = PROVINCE_SLUG_BY_NAME[province.trim()]
  return slug ? `/tenders/${slug}` : null
}

/** Link to an existing category/industry programmatic page when the tender text matches. */
export function categoryBrowsePath(tender: {
  category?: string
  industrySector?: string
  description?: string
  title?: string
}): string | null {
  const probe = {
    category: tender.category || '',
    industrySector: tender.industrySector || '',
    description: tender.description || '',
    title: tender.title || '',
  }
  const hay = `${probe.category} ${probe.industrySector} ${probe.description} ${probe.title}`.toLowerCase()
  for (const slug of PROGRAMMATIC_SLUGS) {
    if (slug in PROGRAMMATIC_PROVINCE_BY_SLUG) continue
    const config = PROGRAMMATIC_TENDER_PAGES[slug]
    if (!config) continue
    if (config.filter(probe as Parameters<typeof config.filter>[0])) {
      return `/tenders/${slug}`
    }
  }
  if (!hay.trim()) return null
  return null
}

export function isProgrammaticBrowseSlug(slug: string): boolean {
  return slug in PROGRAMMATIC_TENDER_PAGES
}
