import Link from 'next/link'
import MarketingPageLayout from '@/components/marketing/MarketingPageLayout'
import JsonLd from '@/components/seo/JsonLd'
import SeoFaqSection, { SeoCtaBand, type SeoFaqItem } from '@/components/seo/SeoFaqSection'
import FeatureCard from '@/components/ui/FeatureCard'
import SectionLabel from '@/components/ui/SectionLabel'
import { breadcrumbJsonLd, faqPageJsonLd } from '@/lib/seo/structuredData'
import { CheckCircle2, Sparkles } from 'lucide-react'

export interface SeoLandingConfig {
  path: string
  eyebrow: string
  title: string
  heroDescription: string
  intro: string
  highlights: string[]
  features: Array<{ title: string; text: string }>
  faqs: SeoFaqItem[]
  ctaTitle: string
  ctaDescription: string
  relatedLinks?: Array<{ href: string; label: string }>
}

export default function SeoLandingPage({ config }: { config: SeoLandingConfig }) {
  const breadcrumbs = breadcrumbJsonLd([
    { name: 'Home', path: '/' },
    { name: config.title, path: config.path },
  ])

  return (
    <>
      <JsonLd data={breadcrumbs} />
      <JsonLd data={faqPageJsonLd(config.faqs)} />
      <MarketingPageLayout
        eyebrow={config.eyebrow}
        title={config.title}
        description={config.heroDescription}
        heroTone="dark"
        heroExtra={
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/auth/signup"
              className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-accent-500 px-6 py-3 text-sm font-semibold text-brand-900"
            >
              Register free as an SME
            </Link>
            <Link
              href="/tenders"
              className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-white/20 px-6 py-3 text-sm font-semibold text-white"
            >
              View tender opportunities
            </Link>
          </div>
        }
      >
        <div className="max-w-4xl">
          <SectionLabel>Overview</SectionLabel>
          <p className="mt-4 text-lg leading-relaxed text-slate-700">{config.intro}</p>

          <ul className="mt-8 space-y-3">
            {config.highlights.map((item) => (
              <li key={item} className="flex items-start gap-3 text-slate-700">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-accent-600" />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <div className="mt-12 grid gap-5 md:grid-cols-2">
            {config.features.map((feature) => (
              <FeatureCard
                key={feature.title}
                icon={Sparkles}
                title={feature.title}
                description={feature.text}
              />
            ))}
          </div>

          <p className="mt-10 rounded-2xl border border-accent-200 bg-accent-50/60 px-5 py-4 text-sm text-brand-900">
            <strong>Free for SMEs:</strong> discovering compulsory tender briefings on TenderBriefing
            costs nothing. You only pay the fixed <strong>R249</strong> fee when you request a verified
            Youth Agent to attend a compulsory briefing on your behalf.
          </p>

          {config.relatedLinks && config.relatedLinks.length > 0 && (
            <div className="mt-10">
              <SectionLabel>Related pages</SectionLabel>
              <div className="mt-4 flex flex-wrap gap-2">
                {config.relatedLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="rounded-full border border-brand-100 bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-800 hover:bg-brand-100"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          )}

          <SeoFaqSection faqs={config.faqs} />

          <SeoCtaBand
            title={config.ctaTitle}
            description={config.ctaDescription}
            primaryHref="/auth/signup"
            primaryLabel="Create free SME account"
            secondaryHref="/tenders"
            secondaryLabel="Browse compulsory briefings"
          />
        </div>
      </MarketingPageLayout>
    </>
  )
}
