import {
  OFFICE_ADDRESS,
  OFFICE_EMAIL,
  OFFICE_PHONE_DISPLAY,
  OFFICE_STREET_ADDRESS,
  SUPPORT_EMAIL,
} from '@/lib/contact'
import { ORG_DESCRIPTION, SITE_NAME, SITE_URL, absoluteUrl } from './site'

export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: absoluteUrl('/brand/logo.png'),
    description: ORG_DESCRIPTION,
    email: OFFICE_EMAIL,
    telephone: OFFICE_PHONE_DISPLAY,
    address: {
      '@type': 'PostalAddress',
      streetAddress: OFFICE_STREET_ADDRESS,
      addressLocality: OFFICE_ADDRESS.city,
      addressRegion: OFFICE_ADDRESS.region,
      postalCode: OFFICE_ADDRESS.postalCode,
      addressCountry: OFFICE_ADDRESS.countryCode,
    },
    areaServed: {
      '@type': 'Country',
      name: 'South Africa',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: SUPPORT_EMAIL,
      telephone: OFFICE_PHONE_DISPLAY,
      areaServed: 'ZA',
      availableLanguage: 'English',
    },
  }
}

export function websiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
    description: ORG_DESCRIPTION,
    inLanguage: 'en-ZA',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/tenders?search={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  }
}

export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  }
}

export function faqPageJsonLd(faqs: Array<{ question: string; answer: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  }
}

export function articleJsonLd(input: {
  title: string
  description: string
  path: string
  publishedAt: string
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: input.title,
    description: input.description,
    datePublished: input.publishedAt,
    author: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
      logo: {
        '@type': 'ImageObject',
        url: absoluteUrl('/brand/logo.png'),
      },
    },
    mainEntityOfPage: absoluteUrl(input.path),
    inLanguage: 'en-ZA',
  }
}

export function collectionPageJsonLd(input: {
  name: string
  description: string
  path: string
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: input.name,
    description: input.description,
    url: absoluteUrl(input.path),
    inLanguage: 'en-ZA',
    isPartOf: {
      '@type': 'WebSite',
      name: SITE_NAME,
      url: SITE_URL,
    },
  }
}

export function itemListJsonLd(items: Array<{ name: string; path: string }>) {
  if (!items.length) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      url: absoluteUrl(item.path),
    })),
  }
}
