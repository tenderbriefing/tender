import type { Metadata } from 'next'
import { BRIEFING_PRICE_LABEL } from '@/lib/domain/briefingPricing'
import { buildPageMetadata } from '@/lib/seo/metadata'

export const metadata: Metadata = buildPageMetadata({
  title: 'Create Free SME Account | Tender Briefing South Africa',
  description:
    `Register free on TenderBriefing to discover compulsory government tender briefings in South Africa. Pay ${BRIEFING_PRICE_LABEL} only when you request a Youth Agent for briefing attendance.`,
  path: '/auth/signup',
  keywords: [
    'tender briefing registration',
    'SME tender account',
    'compulsory tender briefings South Africa',
  ],
})

export default function SignUpLayout({ children }: { children: React.ReactNode }) {
  return children
}
