import Link from 'next/link'
import MarketingPageLayout from '@/components/marketing/MarketingPageLayout'
import JsonLd from '@/components/seo/JsonLd'
import SeoFaqSection, { SeoCtaBand } from '@/components/seo/SeoFaqSection'
import type { ResourceArticle } from '@/lib/seo/resources'
import { breadcrumbJsonLd, faqPageJsonLd } from '@/lib/seo/structuredData'

export default function ResourceArticlePage({ article }: { article: ResourceArticle }) {
  const breadcrumbs = breadcrumbJsonLd([
    { name: 'Home', path: '/' },
    { name: 'Resources', path: '/resources' },
    { name: article.title, path: `/resources/${article.slug}` },
  ])

  return (
    <>
      <JsonLd data={breadcrumbs} />
      {article.faqs && article.faqs.length > 0 && <JsonLd data={faqPageJsonLd(article.faqs)} />}
      <MarketingPageLayout
        eyebrow="Resources · Procurement guides"
        title={article.title}
        description={article.excerpt}
      >
        <article className="max-w-3xl">
          <p className="text-sm text-slate-500">Published {article.publishedAt}</p>

          {article.sections.map((section) => (
            <section key={section.heading} className="mt-10">
              <h2 className="text-2xl font-bold text-brand-900">{section.heading}</h2>
              <div className="mt-4 space-y-4 text-slate-700 leading-relaxed">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}

          <div className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
            <p>
              Ready to act on what you learned?{' '}
              <Link href="/tenders" className="font-semibold text-brand-800 hover:underline">
                Browse compulsory tender briefings
              </Link>{' '}
              or{' '}
              <Link href="/how-it-works" className="font-semibold text-brand-800 hover:underline">
                see how TenderBriefing works
              </Link>
              . Registration is free for SMEs.
            </p>
          </div>

          {article.faqs && article.faqs.length > 0 && (
            <SeoFaqSection faqs={article.faqs} />
          )}

          <SeoCtaBand
            title="Put this knowledge into action"
            description="Register free, track compulsory briefings and request a Youth Agent for R249 only when you need attendance support."
            primaryHref="/auth/signup"
            primaryLabel="Create free SME account"
            secondaryHref="/tenders"
            secondaryLabel="View tenders"
          />
        </article>
      </MarketingPageLayout>
    </>
  )
}

export function ResourcesIndexList({
  articles,
}: {
  articles: Array<{ slug: string; title: string; excerpt: string; publishedAt: string }>
}) {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {articles.map((article) => (
        <Link
          key={article.slug}
          href={`/resources/${article.slug}`}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-accent-700">
            {article.publishedAt}
          </p>
          <h2 className="mt-3 text-lg font-bold text-brand-900">{article.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{article.excerpt}</p>
          <span className="mt-4 inline-block text-sm font-semibold text-brand-800">
            Read article →
          </span>
        </Link>
      ))}
    </div>
  )
}
