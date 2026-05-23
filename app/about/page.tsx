import type { Metadata } from 'next'
import MarketingPageLayout from '@/components/marketing/MarketingPageLayout'
import AnimateIn from '@/components/ui/AnimateIn'
import { Building2, Heart, Lightbulb, Users } from 'lucide-react'

export const metadata: Metadata = {
  title: 'About',
  description:
    'TenderBriefing is South Africa\'s procurement intelligence platform connecting SMEs with Youth Agents for compulsory tender briefings.',
}

const pillars = [
  {
    icon: Building2,
    title: 'Procurement intelligence for SMEs',
    text: 'We help businesses discover and act on tenders with compulsory briefing requirements — without missing compliance deadlines.',
  },
  {
    icon: Users,
    title: 'Youth empowerment at scale',
    text: 'Verified Youth Agents earn income while gaining real experience in government procurement across South Africa.',
  },
  {
    icon: Lightbulb,
    title: 'Technology that works in the field',
    text: 'Official data sync, smart briefing detection, and operational workflows built for how tenders actually run.',
  },
  {
    icon: Heart,
    title: 'Nationwide impact',
    text: 'We are building an ecosystem where access to opportunity is not limited by geography or travel capacity.',
  },
]

export default function AboutPage() {
  return (
    <MarketingPageLayout
      eyebrow="About TenderBriefing"
      title="A procurement support platform built for South Africa"
      description="TenderBriefing combines official government procurement data, operational tooling, and a nationwide Youth Agent network so SMEs can compete fairly for government work."
    >
      <div className="mx-auto max-w-3xl text-center">
        <AnimateIn>
          <p className="text-lg text-slate-600 leading-relaxed">
            Many SMEs lose opportunities not because they cannot deliver — but because they
            cannot attend compulsory briefing meetings in person. TenderBriefing exists to
            close that gap with intelligence, coordination, and trusted attendance support.
          </p>
        </AnimateIn>
      </div>
      <div className="mt-14 grid gap-6 sm:grid-cols-2">
        {pillars.map((p, i) => (
          <AnimateIn key={p.title} delay={i * 0.06}>
            <article className="rounded-2xl border border-slate-100 bg-white p-8 shadow-sm">
              <p.icon className="h-8 w-8 text-brand-600" />
              <h2 className="mt-4 text-xl font-bold text-slate-900">{p.title}</h2>
              <p className="mt-2 text-slate-600 leading-relaxed">{p.text}</p>
            </article>
          </AnimateIn>
        ))}
      </div>
    </MarketingPageLayout>
  )
}
