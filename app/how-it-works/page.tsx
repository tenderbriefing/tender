import type { Metadata } from 'next'
import Link from 'next/link'
import MarketingPageLayout from '@/components/marketing/MarketingPageLayout'
import AnimateIn from '@/components/ui/AnimateIn'
import { ArrowRight, Building2, Users } from 'lucide-react'

export const metadata: Metadata = {
  title: 'How It Works',
  description:
    'How SMEs request briefing attendance support and how Youth Agents attend briefings, upload reports, and build reliability scores.',
}

const smeSteps = [
  {
    step: '1',
    title: 'Find tenders',
    text: 'Browse live government opportunities filtered for compulsory briefing sessions, provinces, and closing dates.',
  },
  {
    step: '2',
    title: 'Request briefing attendance',
    text: 'Submit an attendance support request for the briefing you cannot attend in person. Pay the standard fee when checkout is enabled.',
  },
  {
    step: '3',
    title: 'Agent attends on your behalf',
    text: 'TenderBriefing dispatches a nearby verified Youth Agent using smart matching, reliability scoring, and SLA monitoring.',
  },
  {
    step: '4',
    title: 'Receive your briefing report',
    text: 'Review a structured digital report with key procurement intelligence from the session.',
  },
  {
    step: '5',
    title: 'Submit your tender officially',
    text: 'Use the report to prepare your response. Final tender submission remains your responsibility through official government channels.',
  },
]

const agentSteps = [
  {
    step: '1',
    title: 'Register as a Youth Agent',
    text: 'Complete onboarding with province, transport availability, and code of conduct acceptance.',
  },
  {
    step: '2',
    title: 'Receive opportunities',
    text: 'Get notified of nearby paid briefing assignments via the platform and WhatsApp where configured.',
  },
  {
    step: '3',
    title: 'Attend briefings',
    text: 'Represent the SME at the compulsory session, capture notes, and meet attendance requirements.',
  },
  {
    step: '4',
    title: 'Upload reports',
    text: 'Submit structured briefing reports through the agent dashboard with documents and observations.',
  },
  {
    step: '5',
    title: 'Build your reliability score',
    text: 'Acceptance speed, completion rate, SME ratings, and report quality determine your Platinum–At Risk tier.',
  },
]

function StepList({
  title,
  icon: Icon,
  steps,
  ctaHref,
  ctaLabel,
}: {
  title: string
  icon: typeof Building2
  steps: { step: string; title: string; text: string }[]
  ctaHref: string
  ctaLabel: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50">
          <Icon className="h-6 w-6 text-brand-600" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
      </div>
      <ol className="mt-8 space-y-6">
        {steps.map((s) => (
          <li key={s.step} className="flex gap-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
              {s.step}
            </span>
            <div>
              <h3 className="font-semibold text-slate-900">{s.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{s.text}</p>
            </div>
          </li>
        ))}
      </ol>
      <Link
        href={ctaHref}
        className="mt-8 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-700"
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
      title="From tender discovery to briefing intelligence"
      description="TenderBriefing connects South African SMEs with verified Youth Agents for compulsory tender briefing attendance — without replacing your official tender submission process."
    >
      <div className="grid gap-10 lg:grid-cols-2">
        <AnimateIn>
          <StepList
            title="For SMEs"
            icon={Building2}
            steps={smeSteps}
            ctaHref="/sme/onboarding"
            ctaLabel="Complete SME onboarding"
          />
        </AnimateIn>
        <AnimateIn delay={0.08}>
          <StepList
            title="For Youth Agents"
            icon={Users}
            steps={agentSteps}
            ctaHref="/agent/onboarding"
            ctaLabel="Complete agent onboarding"
          />
        </AnimateIn>
      </div>

      <AnimateIn delay={0.12}>
        <div className="mt-12 rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center">
          <p className="text-sm text-slate-600">
            Questions about reports, payments, or verification? Visit our{' '}
            <Link href="/support" className="font-semibold text-brand-700 hover:underline">
              support centre
            </Link>{' '}
            or view{' '}
            <Link href="/pricing" className="font-semibold text-brand-700 hover:underline">
              pricing
            </Link>
            .
          </p>
        </div>
      </AnimateIn>
    </MarketingPageLayout>
  )
}
