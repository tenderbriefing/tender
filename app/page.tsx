import { Suspense } from 'react'
import Hero from '@/components/home/Hero'
import AudienceSections from '@/components/home/AudienceSections'
import WhyTenderBriefing from '@/components/home/WhyTenderBriefing'
import PlatformFeatures from '@/components/home/PlatformFeatures'
import AttendanceProcess from '@/components/home/AttendanceProcess'
import ProcurementIntelligence from '@/components/home/ProcurementIntelligence'
import VisionSection from '@/components/home/VisionSection'
import FinalCTA from '@/components/home/FinalCTA'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main>
        <Suspense fallback={<LoadingSpinner />}>
          <Hero />
          <AudienceSections />
          <WhyTenderBriefing />
          <PlatformFeatures />
          <AttendanceProcess />
          <ProcurementIntelligence />
          <VisionSection />
          <FinalCTA />
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}
