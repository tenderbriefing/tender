import Link from 'next/link'
import MarketingPageLayout from '@/components/marketing/MarketingPageLayout'
import JsonLd from '@/components/seo/JsonLd'
import SeoFaqSection, { SeoCtaBand } from '@/components/seo/SeoFaqSection'
import SeoLandingStatsBlock from '@/components/seo/SeoLandingStatsBlock'
import SeoLandingTenderList from '@/components/seo/SeoLandingTenderList'
import FeatureCard from '@/components/ui/FeatureCard'
import SectionLabel from '@/components/ui/SectionLabel'
import type { SeoLandingConfig } from '@/lib/seo/landingTypes'
import { STANDARD_INTERNAL_LINKS } from '@/lib/seo/landingTypes'
import {
  breadcrumbJsonLd,
  faqPageJsonLd,
  organizationJsonLd,
} from '@/lib/seo/structuredData'
import { SA_PROVINCES } from '@/lib/procurement/provinces'
import { CheckCircle2, Sparkles } from 'lucide-react'

export type { SeoLandingConfig }

export default function SeoLandingPage({ config }: { config: SeoLandingConfig }) {
  const breadcrumbs = breadcrumbJsonLd([
    { name: 'Home', path: '/' },
    { name: config.title, path: config.path },
  ])

  const provinceChips =
    config.provinceFocus.length > 0 ? config.provinceFocus : [...SA_PROVINCES]

  const internalLinks = [
    ...STANDARD_INTERNAL_LINKS.filter(
      (link) => link.href !== config.path
    ),
    ...config.relatedLinks.filter(
      (link) => !STANDARD_INTERNAL_LINKS.some((s) => s.href === link.href)
    ),
  ]

  return (
    <>
      <JsonLd data={breadcrumbs} />
      <JsonLd data={organizationJsonLd()} />
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
              {config.heroPrimaryCta}
            </Link>
            <Link
              href="/tenders"
              className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-white/20 px-6 py-3 text-sm font-semibold text-white"
            >
              {config.heroSecondaryCta}
            </Link>
          </div>
        }
      >
        <div className="max-w-4xl">
          <SectionLabel>Introduction</SectionLabel>
          <p className="mt-4 text-lg leading-relaxed text-slate-700">{config.intro}</p>

          <SeoLandingStatsBlock />

          <SeoLandingTenderList
            slug={config.slug}
            title={config.tenderSectionTitle}
            intro={config.tenderSectionIntro}
          />

          {config.sections.map((section) => (
            <section key={section.heading} className="mt-14">
              <h2 className="text-2xl font-bold text-brand-900">{section.heading}</h2>
              <div className="mt-4 space-y-4 text-base leading-relaxed text-slate-700">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph.slice(0, 48)}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}

          <section className="mt-14 rounded-3xl border border-brand-200 bg-gradient-to-br from-brand-50/70 to-white p-6 sm:p-8">
            <h2 className="text-2xl font-bold text-brand-900">{config.authority.heading}</h2>
            <div className="mt-4 space-y-4 text-base leading-relaxed text-slate-700">
              {config.authority.paragraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 48)}>{paragraph}</p>
              ))}
            </div>
          </section>

          <section className="mt-14">
            <h2 className="text-2xl font-bold text-brand-900">{config.smeGuidance.title}</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {config.smeGuidance.items.map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <h3 className="font-semibold text-brand-900">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.text}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-14">
            <SectionLabel>Procurement workflow</SectionLabel>
            <ol className="relative mt-8 space-y-6 border-l-2 border-dashed border-brand-200 pl-8">
              {config.processSteps.map((step) => (
                <li key={step.step} className="relative">
                  <span className="absolute -left-[2.05rem] flex h-8 w-8 items-center justify-center rounded-xl bg-brand-900 text-xs font-bold text-accent-400 ring-4 ring-white">
                    {step.step}
                  </span>
                  <h3 className="text-lg font-semibold text-brand-900">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.text}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className="mt-14">
            <h2 className="text-2xl font-bold text-brand-900">Real-world use cases</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {config.useCases.map((useCase) => (
                <div
                  key={useCase.title}
                  className="rounded-2xl border border-accent-100 bg-accent-50/40 p-5"
                >
                  <h3 className="font-semibold text-brand-900">{useCase.title}</h3>
                  <p className="mt-2 text-sm text-slate-600">
                    <span className="font-medium text-brand-800">Scenario: </span>
                    {useCase.scenario}
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    <span className="font-medium text-brand-800">Outcome: </span>
                    {useCase.outcome}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-14">
            <h2 className="text-2xl font-bold text-brand-900">Provinces we track</h2>
            <p className="mt-2 text-slate-600">
              Compulsory briefing opportunities are monitored across South African provinces.
              Explore regional listings or filter live tenders by location.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {provinceChips.map((province) => (
                <Link
                  key={province}
                  href={`/tenders?province=${encodeURIComponent(province)}`}
                  className="rounded-full border border-brand-100 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-800 hover:bg-brand-100"
                >
                  {province}
                </Link>
              ))}
            </div>
          </section>

          <ul className="mt-14 space-y-3">
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
            <strong>Free for SMEs:</strong> discovering compulsory tender briefings on
            TenderBriefing costs nothing. You only pay the fixed <strong>R249</strong> fee when
            you request a verified Youth Agent to attend a compulsory briefing on your behalf.
          </p>

          <section className="mt-14">
            <SectionLabel>Explore TenderBriefing</SectionLabel>
            <div className="mt-4 flex flex-wrap gap-2">
              {internalLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-full border border-brand-100 bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-800 hover:bg-brand-100"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </section>

          <SeoFaqSection faqs={config.faqs} />

          <SeoCtaBand
            title={config.ctaTitle}
            description={config.ctaDescription}
            primaryHref="/auth/signup"
            primaryLabel={config.ctaPrimaryLabel}
            secondaryHref="/tenders"
            secondaryLabel={config.ctaSecondaryLabel}
          />
        </div>
      </MarketingPageLayout>
    </>
  )
}
