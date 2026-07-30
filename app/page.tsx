import type { Metadata } from 'next'
import { Suspense } from 'react'
import Hero from '@/components/home/Hero'
import HowItWorks from '@/components/home/HowItWorks'
import PricingTeaser from '@/components/home/PricingTeaser'
import FinalCTA from '@/components/home/FinalCTA'
import HomeSeoLinks from '@/components/seo/HomeSeoLinks'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { buildPageMetadata } from '@/lib/seo/metadata'

export const metadata: Metadata = buildPageMetadata({
  title: 'Tender Briefing South Africa | Compulsory Government Tender Briefings',
  description:
    'TenderBriefing helps South African SMEs discover compulsory tender briefings from official eTenders data. Free to browse — R249 only when you request a Youth Agent for briefing attendance.',
  path: '/',
  keywords: [
    'Tender Briefing',
    'tender briefing South Africa',
    'compulsory tender briefings',
    'government tenders South Africa',
    'eTenders SME platform',
  ],
})

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <Header transparentOnHome />
      <main>
        <Suspense fallback={<LoadingSpinner />}>
          <Hero />
          <HowItWorks />
          <PricingTeaser />
          <FinalCTA />
          <HomeSeoLinks />
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}
