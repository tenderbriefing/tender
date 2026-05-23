'use client'

import AnimateIn from '@/components/ui/AnimateIn'
import SectionHeading from '@/components/ui/SectionHeading'
import { Heart, Map, Sprout } from 'lucide-react'

export default function VisionSection() {
  return (
    <section className="bg-gradient-to-b from-brand-50/80 to-white py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <SectionHeading
            align="left"
            eyebrow="Our vision"
            title="Building Access to Opportunity Across South Africa"
            description="TenderBriefing is building a nationwide procurement support ecosystem that combines technology, youth empowerment, and operational support."
          />
          <AnimateIn delay={0.1}>
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              {[
                {
                  icon: Map,
                  title: 'Nationwide reach',
                  text: 'Connecting SMEs and Youth Agents across all nine provinces.',
                },
                {
                  icon: Sprout,
                  title: 'Inclusive growth',
                  text: 'Opening procurement participation to businesses and youth historically left out.',
                },
                {
                  icon: Heart,
                  title: 'Sustainable ecosystem',
                  text: 'Technology that scales with public-sector opportunity and private-sector ambition.',
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-brand-100 bg-white p-6 shadow-sm"
                >
                  <item.icon className="mb-3 h-8 w-8 text-brand-600" />
                  <h3 className="font-bold text-slate-900">{item.title}</h3>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">{item.text}</p>
                </div>
              ))}
            </div>
          </AnimateIn>
        </div>
      </div>
    </section>
  )
}
