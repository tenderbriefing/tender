import type { Metadata } from 'next'
import Link from 'next/link'
import MarketingPageLayout from '@/components/marketing/MarketingPageLayout'
import AnimateIn from '@/components/ui/AnimateIn'
import { Check } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Transparent pricing for SMEs and Youth Agents using TenderBriefing for compulsory tender briefing support.',
}

const plans = [
  {
    name: 'SME Starter',
    price: 'From R250',
    period: 'per briefing attendance',
    description: 'For growing businesses entering government procurement.',
    features: [
      'Compulsory briefing discovery',
      'Youth Agent attendance requests',
      'Structured briefing reports',
      'Opportunity dashboard',
      'Email briefing alerts',
    ],
    cta: 'Register as SME',
    href: '/auth/signup?type=sme',
    highlighted: true,
  },
  {
    name: 'Youth Agent',
    price: 'Earn per briefing',
    period: 'competitive rates',
    description: 'For verified agents attending briefings on behalf of SMEs.',
    features: [
      'Nearby opportunity notifications',
      'Reliability rating system',
      'Digital report submission',
      'Flexible schedule',
      'Nationwide assignments',
    ],
    cta: 'Become an Agent',
    href: '/auth/signup?type=youth-agent',
    highlighted: false,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: 'volume pricing',
    description: 'For bid teams managing multiple tenders across provinces.',
    features: [
      'Dedicated account support',
      'Bulk attendance coordination',
      'Custom reporting formats',
      'Team access controls',
      'Priority agent matching',
    ],
    cta: 'Contact Sales',
    href: '/contact',
    highlighted: false,
  },
]

export default function PricingPage() {
  return (
    <MarketingPageLayout
      eyebrow="Pricing"
      title="Simple, transparent pricing for procurement teams"
      description="Whether you are an SME pursuing government work or a Youth Agent building income through briefing attendance, TenderBriefing scales with your needs."
    >
      <div className="grid gap-8 lg:grid-cols-3">
        {plans.map((plan, i) => (
          <AnimateIn key={plan.name} delay={i * 0.08}>
            <article
              className={`flex h-full flex-col rounded-2xl border p-8 ${
                plan.highlighted
                  ? 'border-brand-300 bg-brand-50/30 shadow-card ring-2 ring-brand-500/20'
                  : 'border-slate-200 bg-white shadow-sm'
              }`}
            >
              <h2 className="text-xl font-bold text-slate-900">{plan.name}</h2>
              <p className="mt-2 text-3xl font-bold text-brand-700">{plan.price}</p>
              <p className="text-sm text-slate-500">{plan.period}</p>
              <p className="mt-4 text-sm text-slate-600">{plan.description}</p>
              <ul className="mt-6 flex-1 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={plan.href}
                className={`mt-8 block rounded-xl py-3 text-center text-sm font-semibold transition ${
                  plan.highlighted
                    ? 'bg-brand-600 text-white hover:bg-brand-700'
                    : 'border border-slate-200 text-slate-800 hover:border-brand-300 hover:bg-brand-50'
                }`}
              >
                {plan.cta}
              </Link>
            </article>
          </AnimateIn>
        ))}
      </div>
    </MarketingPageLayout>
  )
}
