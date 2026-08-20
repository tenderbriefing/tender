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
          '/founder',
          '/founder/',
          '/api/',
          '/api/secrets',
          '/api/operational',
          '/profile',
          '/settings',
          '/sme/dashboard',
          '/sme/onboarding',
          '/sme/book-agent',
          '/sme/verify',
          '/agent/dashboard',
          '/agent/workspace',
          '/agent/onboarding',
          '/sme/requests',
          '/sme/rfq-inbox',
          '/notifications',
          '/agent/mobile',
          '/auth/signin',
          '/auth/role-selection',
          '/auth/forgot-password',
          '/auth/reset-password',
          '/auth/welcome',
          '/auth/link-account',
          '/pilot/',
          '/feedback/',
          '/storage-test',
          '/gmail-test',
          '/test',
          '/jobs',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
