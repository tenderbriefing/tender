import type { Metadata } from 'next'
import { buildPageMetadata } from '@/lib/seo/metadata'

export const metadata: Metadata = buildPageMetadata({
  title: 'Tender Briefings South Africa | Compulsory Government Tenders',
  description:
    'Browse compulsory government tender briefings across South Africa. Official eTenders data, briefing dates, documents and free SME discovery on TenderBriefing.',
  path: '/tenders',
  keywords: [
    'tender briefing South Africa',
    'compulsory tender briefings',
    'government tenders',
    'eTenders opportunities',
    'SME tenders',
  ],
})

export default function TendersLayout({ children }: { children: React.ReactNode }) {
  return children
}
