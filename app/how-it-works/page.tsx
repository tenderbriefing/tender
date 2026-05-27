import type { Metadata } from 'next'
import Link from 'next/link'
import MarketingPageLayout from '@/components/marketing/MarketingPageLayout'
import AnimateIn from '@/components/ui/AnimateIn'
import SectionLabel from '@/components/ui/SectionLabel'
import { buildPageMetadata } from '@/lib/seo/metadata'
import { ArrowRight, Building2, Users } from 'lucide-react'

export const metadata: Metadata = buildPageMetadata({
  title: 'How TenderBriefing Works | SME & Youth Agent Briefing Flow',
  description:
    'Learn how SMEs discover compulsory tender briefings for free, request Youth Agents for R249, and receive structured briefing reports on TenderBriefing South Africa.',
  path: '/how-it-works',
  keywords: [
    'how tender briefing works',
    'compulsory briefing attendance',
    'youth agent tender support',
  ],
})

type Step = { step: string; title: string; text: string }

const smeSteps: Step[] = [
  {
    step: '01',
    title: 'Find tenders',
    text: 'Browse live government opportunities filtered for compulsory briefing sessions, provinces, and closing dates.',
  },
  {
    step: '02',
    title: 'Request briefing attendance',
    text: 'Submit an attendance support request for a briefing you cannot attend. Pay only when checkout is enabled.',
  },
  {
    step: '03',
    title: 'Agent attends on your behalf',
    text: 'TenderBriefing dispatches a nearby verified Youth Agent using smart matching, reliability scoring, and SLA monitoring.',
  },
  {
    step: '04',
    title: 'Receive your briefing report',
    text: 'Review a structured digital report with key procurement intelligence from the session.',
  },
  {
    step: '05',
    title: 'Submit your tender officially',
    text: 'Use the report to prepare your response. Final tender submission remains your responsibility through official portals.',
  },
]

const agentSteps: Step[] = [
  {
    step: '01',
    title: 'Register as a Youth Agent',
    text: 'Complete onboarding with province, transport availability, and code of conduct acceptance.',
  },
  {
    step: '02',
    title: 'Receive opportunities',
    text: 'Get notified of nearby paid briefing assignments via the platform and WhatsApp where configured.',
  },
  {
    step: '03',
    title: 'Attend briefings',
    text: 'Represent the SME at the compulsory session, capture notes, and meet attendance requirements.',
  },
  {
    step: '04',
    title: 'Upload reports',
    text: 'Submit structured briefing reports through the agent dashboard with documents and observations.',
  },
  {
    step: '05',
    title: 'Build your reliability score',
    text: 'Acceptance speed, completion rate, SME ratings, and report quality determine your tier.',
  },
]

function Track({
  title,
  icon: Icon,
  steps,
  ctaHref,
  ctaLabel,
  variant,
}: {
  title: string
  icon: typeof Building2
  steps: Step[]
  ctaHref: string
  ctaLabel: string
  variant: 'sme' | 'agent'
}) {
  const isSme = variant === 'sme'
  return (
    <div
      className={`relative overflow-hidden rounded-3xl border p-8 shadow-sm ${
        isSme
          ? 'border-brand-200 bg-gradient-to-br from-white via-brand-50/30 to-white'
          : 'border-accent-200 bg-gradient-to-br from-white via-accent-50/40 to-white'
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-2xl shadow-soft ${
            isSme ? 'bg-brand-900 text-accent-400' : 'bg-accent-500 text-brand-900'
          }`}
        >
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <SectionLabel tone={isSme ? 'navy' : 'gold'}>{isSme ? 'For SMEs' : 'For Youth Agents'}</SectionLabel>
          <h2 className="mt-1 text-2xl font-bold text-brand-900">{title}</h2>
        </div>
      </div>

      <ol className="relative mt-8 space-y-6 border-l-2 border-dashed border-brand-200 pl-8">
        {steps.map((s, idx) => (
          <li key={s.step} className="relative">
            <span
              className={`absolute -left-[2.4rem] flex h-10 w-10 items-center justify-center rounded-xl text-xs font-bold ring-4 ring-white ${
                isSme
                  ? 'bg-brand-900 text-accent-400'
                  : 'bg-accent-500 text-brand-900'
              }`}
            >
              {s.step}
            </span>
            <h3 className="font-bold text-brand-900">{s.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">{s.text}</p>
            {idx === steps.length - 1 && (
              <span className="absolute -left-[2.4rem] -bottom-2 h-2 w-2 rounded-full bg-accent-500" />
            )}
          </li>
        ))}
      </ol>

      <Link
        href={ctaHref}
        className={`mt-8 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition ${
          isSme
            ? 'bg-brand-800 text-white hover:bg-brand-700 shadow-soft'
            : 'bg-accent-500 text-brand-900 hover:bg-accent-400 shadow-gold'
        }`}
      >
        {ctaLabel}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  )
}

export default function HowItWorksPage() {
  return (
    <MarketingPageLayout
      eyebrow="How it works"
      title="From tender discovery to briefing intelligence."
      description="TenderBriefing connects South African SMEs with verified Youth Agents for compulsory tender briefing attendance — without replacing your official submission process."
    >
      <div className="grid gap-10 lg:grid-cols-2">
        <AnimateIn>
          <Track
            title="The SME journey"
            icon={Building2}
            steps={smeSteps}
            ctaHref="/sme/onboarding"
            ctaLabel="Complete SME onboarding"
            variant="sme"
          />
        </AnimateIn>
        <AnimateIn delay={0.08}>
          <Track
            title="The Youth Agent journey"
            icon={Users}
            steps={agentSteps}
            ctaHref="/agent/onboarding"
            ctaLabel="Complete agent onboarding"
            variant="agent"
          />
        </AnimateIn>
      </div>

      <AnimateIn delay={0.12}>
        <div className="mt-12 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-slate-600">
            Questions about reports, payments, or verification? Visit our{' '}
            <Link href="/support" className="font-semibold text-brand-800 hover:text-accent-600">
              support centre
            </Link>{' '}
            or view{' '}
            <Link href="/pricing" className="font-semibold text-brand-800 hover:text-accent-600">
              pricing
            </Link>
            .
          </p>
        </div>
      </AnimateIn>
    </MarketingPageLayout>
  )
}
