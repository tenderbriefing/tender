import type { Metadata } from 'next'
import Link from 'next/link'
import MarketingPageLayout from '@/components/marketing/MarketingPageLayout'
import JsonLd from '@/components/seo/JsonLd'
import { ResourcesIndexList } from '@/components/seo/ResourceArticlePage'
import { buildPageMetadata } from '@/lib/seo/metadata'
import { RESOURCE_ARTICLES } from '@/lib/seo/resources'
import { breadcrumbJsonLd } from '@/lib/seo/structuredData'
import SectionLabel from '@/components/ui/SectionLabel'

export const metadata: Metadata = buildPageMetadata({
  title: 'Tender Briefing Resources & Guides for South African SMEs',
  description:
    'Guides on compulsory tender briefings, SME procurement compliance and how TenderBriefing saves time on site briefings across South Africa.',
  path: '/resources',
  keywords: [
    'tender briefing guide',
    'compulsory briefing South Africa',
    'SME tender tips',
  ],
})

export default function ResourcesPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Resources', path: '/resources' },
        ])}
      />
      <MarketingPageLayout
        eyebrow="Resources · Guides"
        title="Tender briefing resources for SMEs"
        description="Practical guides on compulsory tender briefings, avoiding disqualification and using TenderBriefing effectively."
      >
        <SectionLabel>Starter articles</SectionLabel>
        <ResourcesIndexList articles={RESOURCE_ARTICLES} />
        <div className="mt-12 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-700">
          <p>
            Explore live opportunities on{' '}
            <Link href="/tenders" className="font-semibold text-brand-800 hover:underline">
              /tenders
            </Link>{' '}
            or read about{' '}
            <Link
              href="/compulsory-tender-briefings"
              className="font-semibold text-brand-800 hover:underline"
            >
              compulsory tender briefings
            </Link>
            .
          </p>
        </div>
      </MarketingPageLayout>
    </>
  )
}
