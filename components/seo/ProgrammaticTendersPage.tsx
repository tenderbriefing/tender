import Link from 'next/link'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import JsonLd from '@/components/seo/JsonLd'
import ProgrammaticTenderStaticList from '@/components/seo/ProgrammaticTenderStaticList'
import PageHero from '@/components/ui/PageHero'
import type { CataloguePageResult } from '@/lib/seo/catalogueServerData'
import { PROGRAMMATIC_TENDER_PAGES } from '@/lib/seo/programmaticPages'
import { breadcrumbJsonLd } from '@/lib/seo/structuredData'
import { ArrowRight } from 'lucide-react'

interface ProgrammaticTendersPageProps {
  slug: string
  initial: CataloguePageResult
}

export default function ProgrammaticTendersPage({ slug, initial }: ProgrammaticTendersPageProps) {
  const config = PROGRAMMATIC_TENDER_PAGES[slug]
  if (!config) return null

  const tenders = initial.tenders
  const breadcrumbs = breadcrumbJsonLd([
    { name: 'Home', path: '/' },
    { name: 'Tenders', path: '/tenders' },
    { name: config.title, path: `/tenders/${config.slug}` },
  ])

  return (
    <div className="min-h-screen bg-white">
      <JsonLd data={breadcrumbs} />
      <Header />
      <main>
        <PageHero
          eyebrow={config.eyebrow}
          title={config.heroTitle}
          description={config.heroDescription}
          tone="dark"
        >
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/tenders"
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-accent-500 px-6 py-3 text-sm font-semibold text-brand-900"
            >
              View all tenders
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/auth/role-selection"
              className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-white/20 px-6 py-3 text-sm font-semibold text-white"
            >
              Register free
            </Link>
          </div>
        </PageHero>

        <section className="py-16 lg:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl space-y-4 text-slate-700">
              {config.seoCopy.map((paragraph) => (
                <p key={paragraph} className="leading-relaxed">
                  {paragraph}
                </p>
              ))}
              <p className="rounded-2xl border border-accent-200 bg-accent-50/60 px-5 py-4 text-sm text-brand-900">
                TenderBriefing is <strong>free for SMEs</strong>. Pay the fixed{' '}
                <strong>R249</strong> fee only when you request a Youth Agent to attend a compulsory
                briefing on your behalf.
              </p>
            </div>

            <div className="mt-12">
              <h2 className="font-display text-2xl font-bold text-brand-900">Matching opportunities</h2>
              <p className="mt-2 text-slate-600">
                Live compulsory briefing opportunities synced from official eTenders data.
              </p>

              {tenders.length === 0 ? (
                <p className="mt-8 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-slate-600">
                  No matching compulsory briefings are live right now.{' '}
                  <Link href="/tenders" className="font-semibold text-brand-800 hover:underline">
                    Browse all tender opportunities
                  </Link>{' '}
                  or check back after the next sync.
                </p>
              ) : (
                <ProgrammaticTenderStaticList tenders={tenders} />
              )}

              <div className="mt-10 flex flex-wrap gap-3">
                <Link
                  href="/tenders"
                  className="inline-flex min-h-[44px] items-center rounded-xl bg-brand-800 px-5 py-2.5 text-sm font-semibold text-white"
                >
                  Browse all tenders
                </Link>
                <Link
                  href="/compulsory-tender-briefings"
                  className="inline-flex min-h-[44px] items-center rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-brand-900"
                >
                  About compulsory briefings
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
