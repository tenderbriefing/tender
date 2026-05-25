import type { Metadata } from 'next'
import Link from 'next/link'
import MarketingPageLayout from '@/components/marketing/MarketingPageLayout'
import AnimateIn from '@/components/ui/AnimateIn'
import { ATTENDANCE_FEE_LABEL } from '@/lib/payments/attendanceFee'
import { Check, Info } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Transparent procurement pricing for SMEs and Youth Agents — free tender discovery, pay-per-briefing attendance, and enterprise packages.',
}

const plans = [
  {
    name: 'Free Tender Discovery',
    price: 'R0',
    period: 'always free',
    description:
      'Browse official government tender opportunities and compulsory briefing sessions nationwide.',
    features: [
      'Live tender sync from official sources',
      'Compulsory briefing filters',
      'Province and department tracking',
      'Closing date intelligence',
      'SME workspace and saved tenders',
    ],
    cta: 'Browse tenders',
    href: '/tenders',
    highlighted: false,
  },
  {
    name: 'Pay-per-Briefing Attendance',
    price: ATTENDANCE_FEE_LABEL,
    period: 'per briefing attendance request',
    description:
      'Request a verified Youth Agent to attend a compulsory briefing on your behalf and deliver a structured report.',
    features: [
      'Smart dispatch to nearby agents',
      'WhatsApp status updates',
      'Structured briefing report',
      'SLA-tracked assignment',
      'Secure checkout when payments are enabled',
    ],
    cta: 'Register as SME',
    href: '/auth/signup?type=sme',
    highlighted: true,
    note: 'Online card payment via Yoco is optional until credentials are finalized. Your request is saved either way.',
  },
  {
    name: 'Managed Procurement Support',
    price: 'From R499',
    period: 'per month (pilot)',
    description:
      'For SMEs needing coordinated briefing attendance across multiple tenders and provinces.',
    features: [
      'Priority agent matching',
      'Multi-tender briefing coordination',
      'Dedicated support channel',
      'Report archive and exports',
      'Pilot onboarding assistance',
    ],
    cta: 'Contact support',
    href: '/support',
    highlighted: false,
  },
  {
    name: 'Enterprise SME Package',
    price: 'Custom',
    period: 'annual agreement',
    description:
      'For bid teams, cooperatives, and suppliers managing high tender volumes across departments.',
    features: [
      'Volume briefing attendance',
      'Team accounts and reporting',
      'Custom SLA arrangements',
      'Executive analytics access',
      'Dedicated account manager',
    ],
    cta: 'Contact sales',
    href: '/contact',
    highlighted: false,
  },
]

export default function PricingPage() {
  return (
    <MarketingPageLayout
      eyebrow="Pricing"
      title="Procurement support that scales with your business"
      description="Start with free tender discovery. Pay only when you need Youth Agent briefing attendance. Enterprise packages available for high-volume bid teams."
    >
      <div className="mb-8 rounded-xl border border-brand-100 bg-brand-50/50 px-5 py-4 text-sm text-slate-700">
        <p className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
          <span>
            Standard briefing attendance support fee: <strong>{ATTENDANCE_FEE_LABEL}</strong>.
            Yoco secure checkout is integrated but not required until payment credentials are
            finalized — requests remain in the platform for pilot operations.
          </span>
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        {plans.map((plan, i) => (
          <AnimateIn key={plan.name} delay={i * 0.06}>
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
              <p className="mt-4 text-sm leading-relaxed text-slate-600">{plan.description}</p>
              {'note' in plan && plan.note && (
                <p className="mt-3 text-xs text-slate-500">{plan.note}</p>
              )}
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

      <div className="mt-12 rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center">
        <h3 className="text-lg font-bold text-slate-900">Youth Agents earn per briefing</h3>
        <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600">
          Verified agents receive dispatch opportunities, build reliability scores, and submit
          digital briefing reports. Registration is free — income is earned per completed
          assignment.
        </p>
        <Link
          href="/auth/signup?type=youth-agent"
          className="mt-6 inline-block rounded-xl border border-brand-200 bg-white px-6 py-3 text-sm font-semibold text-brand-800 hover:bg-brand-50"
        >
          Become a Youth Agent
        </Link>
      </div>
    </MarketingPageLayout>
  )
}
