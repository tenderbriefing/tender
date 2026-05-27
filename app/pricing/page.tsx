import type { Metadata } from 'next'
import Link from 'next/link'
import MarketingPageLayout from '@/components/marketing/MarketingPageLayout'
import AnimateIn from '@/components/ui/AnimateIn'
import SectionLabel from '@/components/ui/SectionLabel'
import { buildPageMetadata } from '@/lib/seo/metadata'
import { ATTENDANCE_FEE_LABEL } from '@/lib/payments/attendanceFee'
import { ArrowRight, Check, Crown, Sparkles, Users, Zap } from 'lucide-react'

export const metadata: Metadata = buildPageMetadata({
  title: 'Pricing | Free Tender Discovery & R249 Briefing Agent Fee',
  description:
    'TenderBriefing is free for SMEs to discover compulsory tender briefings. Pay R249 only when you request a verified Youth Agent to attend a compulsory briefing on your behalf.',
  path: '/pricing',
  keywords: [
    'tender briefing pricing',
    'free tender discovery South Africa',
    'youth agent briefing fee',
  ],
})

type Plan = {
  name: string
  badge?: string
  price: string
  period: string
  description: string
  features: string[]
  cta: string
  href: string
  highlighted?: boolean
  tone: 'light' | 'gold' | 'dark'
  note?: string
}

const plans: Plan[] = [
  {
    name: 'Free Tender Discovery',
    badge: 'Always free',
    price: 'R0',
    period: 'forever',
    description:
      'Browse live government tender opportunities and compulsory briefing sessions nationwide — no card required.',
    features: [
      'Live tender sync from official sources',
      'Compulsory briefing filters',
      'Province and department tracking',
      'Closing date intelligence',
      'SME workspace and saved tenders',
    ],
    cta: 'Browse tenders',
    href: '/tenders',
    tone: 'light',
  },
  {
    name: 'Pay-per-Briefing Attendance',
    badge: 'Most popular',
    price: ATTENDANCE_FEE_LABEL,
    period: 'per briefing attended',
    description:
      'Cannot attend a compulsory briefing? Request a verified Youth Agent to attend on your behalf and deliver a structured report.',
    features: [
      'Smart dispatch to nearby verified agents',
      'WhatsApp + in-app status updates',
      'Structured briefing report within 24h',
      'SLA-tracked assignment',
      'Secure Yoco checkout when enabled',
    ],
    cta: 'Register as SME',
    href: '/auth/signup?type=sme',
    highlighted: true,
    tone: 'dark',
    note: 'Pay only when you request attendance support. No subscriptions.',
  },
  {
    name: 'Managed Procurement Support',
    badge: 'For active bidders',
    price: 'From R499',
    period: 'per month (pilot)',
    description:
      'Coordinated briefing attendance across multiple tenders and provinces for SMEs scaling their bid pipeline.',
    features: [
      'Priority agent matching',
      'Multi-tender briefing coordination',
      'Dedicated support channel',
      'Report archive and exports',
      'Pilot onboarding assistance',
    ],
    cta: 'Talk to us',
    href: '/support',
    tone: 'light',
  },
  {
    name: 'Enterprise SME Package',
    badge: 'Custom built',
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
    tone: 'gold',
  },
]

function PlanCard({ plan, index }: { plan: Plan; index: number }) {
  const baseCard =
    'group relative flex h-full flex-col overflow-hidden rounded-3xl p-8 transition'

  const toneClass = {
    light:
      'border border-slate-200 bg-white shadow-sm hover:-translate-y-0.5 hover:shadow-card',
    gold:
      'border border-accent-300 bg-gradient-to-br from-accent-50 to-white shadow-sm hover:-translate-y-0.5 hover:shadow-card',
    dark:
      'border border-brand-700 bg-gradient-to-br from-brand-900 via-brand-800 to-brand-950 text-white shadow-card hover:-translate-y-0.5',
  }[plan.tone]

  const textTone = plan.tone === 'dark' ? 'text-white' : 'text-brand-900'
  const subTone = plan.tone === 'dark' ? 'text-brand-100/80' : 'text-slate-600'
  const dividerTone = plan.tone === 'dark' ? 'border-white/10' : 'border-slate-100'

  return (
    <AnimateIn delay={index * 0.06}>
      <article className={`${baseCard} ${toneClass}`}>
        {plan.tone === 'dark' && (
          <>
            <div className="pointer-events-none absolute -top-20 -right-20 h-48 w-48 rounded-full bg-accent-500/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-24 h-48 w-48 rounded-full bg-brand-500/30 blur-3xl" />
          </>
        )}

        {plan.badge && (
          <span
            className={`absolute right-6 top-6 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${
              plan.tone === 'dark'
                ? 'bg-accent-500 text-brand-900'
                : plan.tone === 'gold'
                  ? 'bg-brand-900 text-accent-300'
                  : 'bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-200'
            }`}
          >
            {plan.highlighted && <Sparkles className="h-3 w-3" aria-hidden />}
            {plan.badge}
          </span>
        )}

        <div className="relative">
          <h2 className={`text-xl font-bold ${textTone}`}>{plan.name}</h2>
          <div className="mt-5 flex items-baseline gap-2">
            <span
              className={`text-4xl font-bold tracking-tight ${
                plan.tone === 'dark' ? 'text-accent-400' : 'text-brand-900'
              }`}
            >
              {plan.price}
            </span>
            <span className={`text-sm ${subTone}`}>· {plan.period}</span>
          </div>
          <p className={`mt-4 text-sm leading-relaxed ${subTone}`}>{plan.description}</p>
          {plan.note && (
            <p
              className={`mt-3 rounded-lg px-3 py-2 text-xs leading-relaxed ${
                plan.tone === 'dark'
                  ? 'bg-white/5 text-accent-200'
                  : 'bg-accent-50 text-brand-800'
              }`}
            >
              {plan.note}
            </p>
          )}
        </div>

        <ul className={`relative mt-6 space-y-3 border-t ${dividerTone} pt-6 flex-1`}>
          {plan.features.map((f) => (
            <li key={f} className={`flex items-start gap-2.5 text-sm ${subTone}`}>
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                  plan.tone === 'dark'
                    ? 'bg-accent-500/15 text-accent-400'
                    : 'bg-brand-100 text-brand-800'
                }`}
              >
                <Check className="h-3 w-3" />
              </span>
              <span className={plan.tone === 'dark' ? 'text-white/90' : 'text-slate-700'}>
                {f}
              </span>
            </li>
          ))}
        </ul>

        <Link
          href={plan.href}
          className={`relative mt-8 inline-flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition ${
            plan.tone === 'dark'
              ? 'bg-accent-500 text-brand-900 shadow-gold hover:bg-accent-400'
              : plan.tone === 'gold'
                ? 'bg-brand-900 text-white hover:bg-brand-800'
                : 'border border-brand-200 bg-white text-brand-900 hover:border-brand-400 hover:bg-brand-50'
          }`}
        >
          {plan.cta}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </article>
    </AnimateIn>
  )
}

export default function PricingPage() {
  return (
    <MarketingPageLayout
      eyebrow="Pricing"
      title="Free for SMEs. Pay only when you need attendance."
      description="Browse tenders and receive matches at no cost. Pay the standard R249 fee only when you request a verified Youth Agent to attend a compulsory briefing on your behalf."
    >
      <div className="mb-10 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-brand-100 bg-white p-5 shadow-sm">
          <Zap className="h-6 w-6 text-accent-500" />
          <p className="mt-3 text-sm font-bold text-brand-900">Always free to browse</p>
          <p className="mt-1 text-xs text-slate-600">
            Tender discovery, matches, and dashboards never cost a cent for SMEs.
          </p>
        </div>
        <div className="rounded-2xl border border-accent-200 bg-gradient-to-br from-accent-50 to-white p-5 shadow-sm">
          <Crown className="h-6 w-6 text-accent-600" />
          <p className="mt-3 text-sm font-bold text-brand-900">R249 only when requested</p>
          <p className="mt-1 text-xs text-slate-600">
            Pay-as-you-go briefing attendance. No subscriptions, no surprises.
          </p>
        </div>
        <div className="rounded-2xl border border-brand-100 bg-white p-5 shadow-sm">
          <Users className="h-6 w-6 text-brand-800" />
          <p className="mt-3 text-sm font-bold text-brand-900">Verified Youth Agents</p>
          <p className="mt-1 text-xs text-slate-600">
            Background-checked, reliability-scored, and SLA-monitored attendance.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {plans.map((plan, i) => (
          <PlanCard key={plan.name} plan={plan} index={i} />
        ))}
      </div>

      <div className="mt-16 overflow-hidden rounded-3xl bg-gradient-to-br from-brand-900 to-brand-800 px-8 py-12 sm:px-12">
        <div className="pointer-events-none absolute -right-32 -top-32 h-72 w-72 rounded-full bg-accent-500/20 blur-3xl" />
        <div className="relative grid items-center gap-6 lg:grid-cols-[2fr,1fr]">
          <div>
            <SectionLabel tone="light">Youth Agents</SectionLabel>
            <h3 className="mt-3 text-2xl font-bold text-white sm:text-3xl">
              Earn income per briefing attended
            </h3>
            <p className="mt-3 max-w-2xl text-brand-100/80">
              Verified Youth Agents receive paid dispatch opportunities, build reliability scores,
              and submit digital briefing reports. Registration is free — income is earned per
              completed assignment.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
            <Link
              href="/auth/signup?type=youth-agent"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent-500 px-6 py-3 text-sm font-semibold text-brand-900 shadow-gold transition hover:bg-accent-400"
            >
              Become a Youth Agent
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/how-it-works"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/30 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              See how it works
            </Link>
          </div>
        </div>
      </div>
    </MarketingPageLayout>
  )
}
