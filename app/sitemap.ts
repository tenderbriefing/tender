import type { MetadataRoute } from 'next'

const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://www.tenderbriefing.co.za'

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    '',
    '/tenders',
    '/sme-solutions',
    '/youth-agents',
    '/how-it-works',
    '/pricing',
    '/support',
    '/terms',
    '/privacy',
    '/sme/onboarding',
    '/agent/onboarding',
    '/pilot/sme',
    '/pilot/agent',
    '/feedback/sme',
    '/feedback/agent',
    '/about',
    '/contact',
    '/auth/signin',
    '/auth/signup',
  ]

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === '' || route === '/tenders' ? 'daily' : 'weekly',
    priority: route === '' ? 1 : 0.8,
  }))
}
