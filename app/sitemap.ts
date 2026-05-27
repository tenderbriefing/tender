import type { MetadataRoute } from 'next'
import { SEO_LANDING_PATHS } from '@/lib/seo/landingPages'
import { PROGRAMMATIC_SLUGS } from '@/lib/seo/programmaticPages'
import { getPublicTenders } from '@/lib/seo/publicTenders'
import { RESOURCE_ARTICLES } from '@/lib/seo/resources'
import { SITE_URL } from '@/lib/seo/site'

export const dynamic = 'force-dynamic'

const STATIC_ROUTES: Array<{ path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[0]['changeFrequency'] }> = [
  { path: '', priority: 1, changeFrequency: 'daily' },
  { path: '/tenders', priority: 0.95, changeFrequency: 'daily' },
  { path: '/pricing', priority: 0.85, changeFrequency: 'weekly' },
  { path: '/about', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/how-it-works', priority: 0.85, changeFrequency: 'monthly' },
  { path: '/support', priority: 0.75, changeFrequency: 'monthly' },
  { path: '/auth/signup', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/sme-solutions', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/youth-agents', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/terms', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/privacy', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/resources', priority: 0.8, changeFrequency: 'weekly' },
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }))

  const landingEntries: MetadataRoute.Sitemap = SEO_LANDING_PATHS.map((slug) => ({
    url: `${SITE_URL}/${slug}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.85,
  }))

  const programmaticEntries: MetadataRoute.Sitemap = PROGRAMMATIC_SLUGS.map((slug) => ({
    url: `${SITE_URL}/tenders/${slug}`,
    lastModified: now,
    changeFrequency: 'daily',
    priority: 0.8,
  }))

  const resourceEntries: MetadataRoute.Sitemap = RESOURCE_ARTICLES.map((article) => ({
    url: `${SITE_URL}/resources/${article.slug}`,
    lastModified: new Date(article.publishedAt),
    changeFrequency: 'monthly',
    priority: 0.75,
  }))

  let tenderEntries: MetadataRoute.Sitemap = []
  try {
    const tenders = await getPublicTenders()
    tenderEntries = tenders.slice(0, 5000).map((tender) => ({
      url: `${SITE_URL}/tenders/${tender.id}`,
      lastModified: tender.lastSyncedAt ? new Date(tender.lastSyncedAt) : now,
      changeFrequency: 'daily',
      priority: 0.7,
    }))
  } catch {
    tenderEntries = []
  }

  return [
    ...staticEntries,
    ...landingEntries,
    ...programmaticEntries,
    ...resourceEntries,
    ...tenderEntries,
  ]
}
