import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo/site'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/admin/',
          '/api/',
          '/api/secrets',
          '/api/operational',
          '/profile',
          '/sme/dashboard',
          '/agent/dashboard',
          '/sme/requests',
          '/sme/rfq-inbox',
          '/notifications',
          '/agent/mobile',
          '/pilot/',
          '/feedback/',
          '/storage-test',
          '/gmail-test',
          '/test',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
