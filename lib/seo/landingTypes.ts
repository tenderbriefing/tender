import type { SeoFaqItem } from '@/components/seo/SeoFaqSection'

export interface SeoContentSection {
  heading: string
  paragraphs: string[]
}

export interface SeoLandingConfig {
  slug: string
  path: string
  metaDescription: string
  eyebrow: string
  /** Unique H1 */
  title: string
  heroDescription: string
  heroPrimaryCta: string
  heroSecondaryCta: string
  intro: string
  sections: SeoContentSection[]
  authority: SeoContentSection
  smeGuidance: {
    title: string
    items: Array<{ title: string; text: string }>
  }
  processSteps: Array<{ step: string; title: string; text: string }>
  useCases: Array<{ title: string; scenario: string; outcome: string }>
  provinceFocus: string[]
  highlights: string[]
  features: Array<{ title: string; text: string }>
  faqs: SeoFaqItem[]
  ctaTitle: string
  ctaDescription: string
  ctaPrimaryLabel: string
  ctaSecondaryLabel: string
  relatedLinks: Array<{ href: string; label: string }>
  tenderSectionTitle: string
  tenderSectionIntro: string
}

export const STANDARD_INTERNAL_LINKS = [
  { href: '/tenders', label: 'All tender opportunities' },
  { href: '/compulsory-tender-briefings', label: 'Compulsory briefings guide' },
  { href: '/tender-briefing-agent', label: 'Briefing agent service' },
  { href: '/tenders/gauteng', label: 'Gauteng tenders' },
  { href: '/tenders/western-cape', label: 'Western Cape tenders' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/how-it-works', label: 'How it works' },
  { href: '/resources', label: 'Procurement resources' },
  { href: '/tender-briefings-south-africa', label: 'Tender briefings SA' },
] as const
