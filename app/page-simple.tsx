import { Suspense } from 'react'
import Hero from '@/components/home/Hero'
import Features from '@/components/home/Features'
import HowItWorks from '@/components/home/HowItWorks'
import Stats from '@/components/home/Stats'
import CTA from '@/components/home/CTA'
import SimpleHeader from '@/components/layout/SimpleHeader'
import Footer from '@/components/layout/Footer'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <SimpleHeader />
      <main>
        <Suspense fallback={<LoadingSpinner />}>
          <Hero />
          <Features />
          <HowItWorks />
          <Stats />
          <CTA />
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}
