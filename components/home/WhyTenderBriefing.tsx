'use client'

import AnimateIn from '@/components/ui/AnimateIn'
import SectionHeading from '@/components/ui/SectionHeading'
import { Building2, LineChart, Shield, Users } from 'lucide-react'

const cards = [
  {
    icon: Building2,
    title: 'Procurement intelligence',
    text: 'Surface tenders with compulsory briefings so your team focuses on opportunities you can actually pursue.',
  },
  {
    icon: Users,
    title: 'Operational support',
    text: 'Coordinate Youth Agent attendance, reports, and follow-ups without managing logistics yourself.',
  },
  {
    icon: Shield,
    title: 'Trustworthy operations',
    text: 'Verified agents, structured reports, and audit-ready activity logs built for professional SMEs.',
  },
  {
    icon: LineChart,
    title: 'Scalable nationwide coverage',
    text: 'From Gauteng to the Eastern Cape — extend your briefing presence without expanding headcount.',
  },
]

export default function WhyTenderBriefing() {
  return (
    <section id="why-tenderbriefing" className="scroll-mt-24 bg-white py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Why TenderBriefing"
          title="Built for the Real Challenges SMEs Face"
          description="Many SMEs lose out on government opportunities simply because they cannot attend compulsory briefing meetings in person."
        />
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {cards.map((card, i) => (
            <AnimateIn key={card.title} delay={i * 0.08}>
              <article className="relative h-full rounded-2xl border border-slate-100 bg-gradient-to-b from-white to-slate-50/80 p-8 shadow-sm transition hover:shadow-card">
                <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-soft">
                  <card.icon className="h-7 w-7" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">{card.title}</h3>
                <p className="mt-3 text-slate-600 leading-relaxed">{card.text}</p>
              </article>
            </AnimateIn>
          ))}
        </div>
      </div>
    </section>
  )
}
