import type { Metadata } from 'next'
import Link from 'next/link'
import MarketingPageLayout from '@/components/marketing/MarketingPageLayout'
import AnimateIn from '@/components/ui/AnimateIn'
import SectionLabel from '@/components/ui/SectionLabel'
import { buildPageMetadata } from '@/lib/seo/metadata'
import { ATTENDANCE_FEE_LABEL } from '@/lib/payments/attendanceFee'
import {
  ArrowRight,
  Check,
  ClipboardCheck,
  Compass,
  FileText,
  MapPin,
  MessageCircle,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react'

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

const howItWorks = [
  {
    step: '01',
    icon: Search,
    title: 'Browse tenders free',
    text: 'Discover live government opportunities and compulsory briefings nationwide — no card, no subscription.',
  },
  {
    step: '02',
    icon: ClipboardCheck,
    title: 'Request when you need it',
    text: 'Cannot attend in person? Request a verified Youth Agent for that specific briefing only.',
  },
  {
    step: '03',
    icon: ShieldCheck,
    title: 'Pay per attendance',
    text: `You pay ${ATTENDANCE_FEE_LABEL} only when an agent is dispatched to attend on your behalf.`,
  },
]

const attendanceIncludes = [
  'Smart dispatch to a nearby verified Youth Agent',
  'Representation at the compulsory briefing on your behalf',
  'WhatsApp and in-app status updates while the assignment runs',
  'Structured digital briefing report within 24 hours',
  'SLA-tracked assignment from request to report delivery',
]

const freeDiscovery = [
  {
    icon: Compass,
    title: 'Live tender sync',
    text: 'Official government sources, refreshed so you stay ahead of closing dates.',
  },
  {
    icon: MapPin,
    title: 'Compulsory briefing filters',
    text: 'Filter by province, department, and sessions that require in-person attendance.',
  },
  {
    icon: FileText,
    title: 'SME workspace',
    text: 'Save tenders, track deadlines, and manage requests from one place — always free.',
  },
]

export default function PricingPage() {
  return (
    <MarketingPageLayout
      eyebrow="Pricing"
      title="Pay only when you need a Youth Agent"
      description="Browse tenders free. Verified Youth Agents are ready across every municipality to represent your SME at compulsory briefings — you pay R249 only when one attends on your behalf."
      heroExtra={
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/auth/role-selection"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent-500 px-6 py-3 text-sm font-semibold text-brand-900 shadow-gold transition hover:bg-accent-400"
          >
            Get started free
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/tenders"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-brand-200 bg-white px-6 py-3 text-sm font-semibold text-brand-900 transition hover:border-brand-400 hover:bg-brand-50"
          >
            Browse tenders
          </Link>
        </div>
      }
    >
      {/* How pricing works */}
      <div>
        <SectionLabel>How pricing works</SectionLabel>
        <h2 className="mt-3 max-w-2xl font-display text-3xl font-bold text-brand-900 sm:text-4xl">
          Free to discover. Pay only for attendance.
        </h2>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-600">
          There are no packages or monthly plans for SMEs. Discovery is part of the product —
          you only pay when you request Youth Agent attendance.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {howItWorks.map((item, i) => (
            <AnimateIn key={item.step} delay={i * 0.06}>
              <article className="relative h-full rounded-2xl border border-brand-100 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-900 text-accent-400">
                    <item.icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="text-xs font-bold uppercase tracking-[0.16em] text-brand-400">
                    {item.step}
                  </span>
                </div>
                <h3 className="mt-5 font-display text-lg font-bold text-brand-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.text}</p>
              </article>
            </AnimateIn>
          ))}
        </div>
      </div>

      {/* Primary fee panel */}
      <AnimateIn>
        <div className="relative mt-16 overflow-hidden rounded-3xl border border-brand-800 bg-gradient-to-br from-brand-900 via-brand-800 to-brand-950 px-8 py-10 shadow-card sm:px-12 sm:py-12">
          <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-accent-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 -left-20 h-56 w-56 rounded-full bg-brand-500/30 blur-3xl" />

          <div className="relative grid items-center gap-10 lg:grid-cols-[1.2fr,1fr]">
            <div>
              <SectionLabel tone="light">Attendance fee</SectionLabel>
              <h2 className="mt-3 text-2xl font-bold text-white sm:text-3xl">
                {ATTENDANCE_FEE_LABEL} per briefing attended
              </h2>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-brand-100/85">
                Verified Youth Agents are ready across every municipality to represent your SME
                at compulsory briefings. You pay only when you request attendance — no
                subscriptions, no surprises.
              </p>
              <ul className="mt-6 space-y-2.5">
                {[
                  'No monthly SME fees',
                  'No commitment beyond the briefing you request',
                  'Secure PayFast checkout when payment is enabled',
                ].map((line) => (
                  <li key={line} className="flex items-start gap-2.5 text-sm text-brand-100/90">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-500/15 text-accent-400">
                      <Check className="h-3 w-3" aria-hidden />
                    </span>
                    {line}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl bg-white/5 p-7 ring-1 ring-inset ring-white/10 backdrop-blur-sm">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent-300">
                Standard fee
              </p>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-5xl font-bold tracking-tight text-accent-400">
                  {ATTENDANCE_FEE_LABEL.replace(/\.00$/, '')}
                </span>
                <span className="text-sm text-brand-100/75">per attendance</span>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-brand-100/80">
                Charged only when you request a Youth Agent for a specific compulsory briefing.
              </p>
              <div className="mt-7 flex flex-col gap-3">
                <Link
                  href="/auth/role-selection"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent-500 px-5 py-3 text-sm font-semibold text-brand-900 shadow-gold transition hover:bg-accent-400"
                >
                  Register as SME
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/tenders"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/25 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Browse tenders free
                </Link>
              </div>
            </div>
          </div>
        </div>
      </AnimateIn>

      {/* What's included */}
      <div className="mt-16 grid gap-10 lg:grid-cols-[1fr,1.1fr] lg:items-start">
        <div>
          <SectionLabel>Attendance support</SectionLabel>
          <h2 className="mt-3 font-display text-3xl font-bold text-brand-900 sm:text-4xl">
            What&apos;s included when an agent attends
          </h2>
          <p className="mt-3 text-base leading-relaxed text-slate-600">
            The fee covers a single briefing attendance assignment — not a package or tier.
            You get operational support from request through to your report.
          </p>
        </div>
        <ul className="space-y-3 rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50/40 to-white p-6 sm:p-8">
          {attendanceIncludes.map((item) => (
            <li key={item} className="flex items-start gap-3 text-sm text-slate-700">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-800">
                <Check className="h-3 w-3" aria-hidden />
              </span>
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* Always-free discovery */}
      <div className="mt-16">
        <SectionLabel>Always free</SectionLabel>
        <h2 className="mt-3 max-w-2xl font-display text-3xl font-bold text-brand-900 sm:text-4xl">
          Tender discovery is product value — not a paid plan
        </h2>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-600">
          Every SME can browse, filter, and track compulsory briefings at no cost. You only
          pay when you choose attendance support.
        </p>

        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {freeDiscovery.map((item, i) => (
            <AnimateIn key={item.title} delay={i * 0.06}>
              <article className="h-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-100">
                  <item.icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-4 font-display text-lg font-bold text-brand-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.text}</p>
              </article>
            </AnimateIn>
          ))}
        </div>
      </div>

      {/* High-volume contact — not a package */}
      <AnimateIn>
        <div className="mt-16 flex flex-col gap-6 rounded-2xl border border-slate-200 bg-slate-50/80 px-6 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-brand-800 shadow-sm ring-1 ring-inset ring-slate-200">
              <MessageCircle className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h2 className="font-display text-lg font-bold text-brand-900">High briefing volume?</h2>
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-slate-600">
                Coordinating many compulsory sessions across provinces? Talk to us about
                operational support — without locking into a package.
              </p>
            </div>
          </div>
          <Link
            href="/contact"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-brand-200 bg-white px-5 py-3 text-sm font-semibold text-brand-900 transition hover:border-brand-400 hover:bg-brand-50"
          >
            Contact us
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </AnimateIn>

      {/* Youth Agents */}
      <div className="relative mt-16 overflow-hidden rounded-3xl bg-gradient-to-br from-brand-900 to-brand-800 px-8 py-12 sm:px-12">
        <div className="pointer-events-none absolute -right-32 -top-32 h-72 w-72 rounded-full bg-accent-500/20 blur-3xl" />
        <div className="relative grid items-center gap-6 lg:grid-cols-[2fr,1fr]">
          <div>
            <SectionLabel tone="light">Youth Agents</SectionLabel>
            <h3 className="mt-3 font-display text-2xl font-bold text-white sm:text-3xl">
              Earn income per briefing attended
            </h3>
            <p className="mt-3 max-w-2xl text-brand-100/80">
              Verified Youth Agents receive paid dispatch opportunities, build reliability
              scores, and submit digital briefing reports. Registration is free — income is
              earned per completed assignment.
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

      <p className="mt-10 flex items-center justify-center gap-2 text-center text-sm text-slate-500">
        <Users className="h-4 w-4 text-brand-600" aria-hidden />
        Nationwide municipal coverage — verified agents ready when you need them.
      </p>
    </MarketingPageLayout>
  )
}
