import type { Metadata } from 'next'
import {
  DEFAULT_KEYWORDS,
  DEFAULT_OG_IMAGE,
  SITE_NAME,
  SITE_URL,
  absoluteUrl,
  truncateMeta,
} from './site'

export interface PageSeoInput {
  title: string
  description: string
  path?: string
  keywords?: string[]
  ogImage?: string
  noIndex?: boolean
  type?: 'website' | 'article'
}

export function buildPageMetadata(input: PageSeoInput): Metadata {
  const canonical = input.path ? absoluteUrl(input.path) : SITE_URL
  const description = truncateMeta(input.description)
  const ogImage = input.ogImage || DEFAULT_OG_IMAGE
  // Layout template adds " | TenderBriefing" — keep page title without suffix here.
  const pageTitle = input.title.replace(new RegExp(`\\s*\\|\\s*${SITE_NAME}\\s*$`, 'i'), '').trim()
  const fullTitle = `${pageTitle} | ${SITE_NAME}`

  return {
    title: pageTitle,
    description,
    keywords: input.keywords || [...DEFAULT_KEYWORDS],
    alternates: { canonical },
    openGraph: {
      type: input.type || 'website',
      locale: 'en_ZA',
      url: canonical,
      siteName: SITE_NAME,
      title: fullTitle,
      description,
      images: [{ url: ogImage, alt: SITE_NAME }],
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [ogImage],
    },
    robots: input.noIndex
      ? { index: false, follow: false, googleBot: { index: false, follow: false } }
      : { index: true, follow: true },
  }
}

export const PRIVATE_ROUTE_ROBOTS: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
}
