import type { Metadata } from 'next'
import Link from 'next/link'
import MarketingPageLayout from '@/components/marketing/MarketingPageLayout'
import AnimateIn from '@/components/ui/AnimateIn'
import FeatureCard from '@/components/ui/FeatureCard'
import SectionLabel from '@/components/ui/SectionLabel'
import {
  ArrowRight,
  Building2,
  Compass,
  Heart,
  Lightbulb,
  Sparkles,
  Users,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'About',
  description:
    "TenderBriefing is South Africa's procurement intelligence platform connecting SMEs with verified Youth Agents for compulsory tender briefings.",
}

const pillars = [
  {
    icon: Building2,
    title: 'Procurement intelligence for SMEs',
    text: 'Discover and act on tenders with compulsory briefing requirements without missing compliance deadlines.',
    tone: 'navy' as const,
  },
  {
    icon: Users,
    title: 'Youth empowerment at scale',
    text: 'Verified Youth Agents earn income while gaining real experience in government procurement across South Africa.',
    tone: 'gold' as const,
  },
  {
    icon: Lightbulb,
    title: 'Technology built for the field',
    text: 'Official data sync, smart briefing detection, and operational workflows built for how tenders actually run.',
    tone: 'default' as const,
  },
  {
    icon: Heart,
    title: 'Nationwide impact',
    text: 'Access to opportunity should not be limited by geography or travel capacity — we close that gap.',
    tone: 'default' as const,
  },
]

const stats = [
  { value: '9', label: 'Provinces covered' },
  { value: 'R249', label: 'Per briefing fee' },
  { value: '24h', label: 'Report SLA' },
  { value: 'R0', label: 'SME platform cost' },
]

export default function AboutPage() {
  return (
    <MarketingPageLayout
      eyebrow="About TenderBriefing"
      title="A procurement support platform built for South Africa"
      description="We combine official government procurement data, operational tooling, and a nationwide Youth Agent network so SMEs can compete fairly for government work."
    >
      <AnimateIn>
        <div className="mx-auto max-w-3xl rounded-3xl border border-brand-100 bg-gradient-to-br from-brand-50/50 to-white p-8 text-center shadow-sm sm:p-10">
          <Compass className="mx-auto h-10 w-10 text-accent-500" />
          <h2 className="mt-4 text-2xl font-bold text-brand-900 sm:text-3xl">
            The opportunity gap, closed.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-600">
            Many SMEs lose opportunities not because they cannot deliver — but because they
            cannot attend compulsory briefing meetings in person. TenderBriefing exists to close
            that gap with intelligence, coordination, and trusted attendance support.
          </p>
        </div>
      </AnimateIn>

      <div className="mt-16">
        <AnimateIn>
          <SectionLabel>What we stand for</SectionLabel>
          <h2 className="mt-3 text-3xl font-bold text-brand-900 sm:text-4xl">
            Four pillars shaping how we build.
          </h2>
        </AnimateIn>
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {pillars.map((p, i) => (
            <AnimateIn key={p.title} delay={i * 0.06}>
              <FeatureCard icon={p.icon} title={p.title} description={p.text} tone={p.tone} />
            </AnimateIn>
          ))}
        </div>
      </div>

      <AnimateIn>
        <div className="mt-16 overflow-hidden rounded-3xl bg-gradient-to-br from-brand-900 via-brand-800 to-brand-950 px-8 py-12 sm:px-14">
          <div className="pointer-events-none absolute -right-32 -top-32 h-64 w-64 rounded-full bg-accent-500/20 blur-3xl" />
          <div className="relative">
            <SectionLabel tone="light">By the numbers</SectionLabel>
            <h2 className="mt-3 max-w-2xl text-2xl font-bold text-white sm:text-3xl">
              Built for South African procurement realities.
            </h2>
            <div className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-4">
              {stats.map((s) => (
                <div key={s.label} className="rounded-2xl bg-white/5 px-5 py-6 ring-1 ring-inset ring-white/10">
                  <p className="text-3xl font-bold text-accent-400">{s.value}</p>
                  <p className="mt-1 text-xs font-medium text-brand-100/80">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href="/sme/onboarding"
                className="inline-flex items-center gap-2 rounded-xl bg-accent-500 px-5 py-3 text-sm font-semibold text-brand-900 shadow-gold transition hover:bg-accent-400"
              >
                <Sparkles className="h-4 w-4" />
                Start as SME — Free
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/agent/onboarding"
                className="inline-flex items-center gap-2 rounded-xl border border-white/30 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Become a Youth Agent
              </Link>
            </div>
          </div>
        </div>
      </AnimateIn>
    </MarketingPageLayout>
  )
}
