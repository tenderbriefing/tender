import type { Metadata } from 'next'
import Link from 'next/link'
import MarketingPageLayout from '@/components/marketing/MarketingPageLayout'
import AnimateIn from '@/components/ui/AnimateIn'
import SectionLabel from '@/components/ui/SectionLabel'
import {
  AlertCircle,
  ArrowRight,
  HelpCircle,
  Mail,
  MessageCircle,
  Phone,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Support',
  description:
    'TenderBriefing support — WhatsApp, email, FAQs, briefing reports, and Youth Agent verification.',
}

const WHATSAPP_URL = 'https://wa.me/27100133423'
const SUPPORT_EMAIL = 'support@tenderbriefing.co.za'

const faqs = [
  {
    q: 'What is a compulsory tender briefing?',
    a: 'Some government tenders require attendance at a briefing or site meeting before you may submit a bid. Missing it can disqualify your response. TenderBriefing helps you track these sessions and request attendance support.',
  },
  {
    q: 'How do briefing reports work?',
    a: 'After a Youth Agent attends on your behalf, they upload a structured report through the platform. You receive procurement intelligence from the session to inform your bid — not a substitute for official submission.',
  },
  {
    q: 'How are Youth Agents verified?',
    a: 'Agents complete onboarding, accept a code of conduct, and enter a pending verification state. Admin operations review reliability scores, report quality, and attendance history before elevating trust tiers.',
  },
  {
    q: 'Do I still submit my tender through TenderBriefing?',
    a: 'No. Final tender submission remains your responsibility through official government portals (e.g. eTenders). TenderBriefing provides discovery, attendance support, and intelligence only.',
  },
  {
    q: 'What if payment fails?',
    a: 'Your attendance request is saved. You can retry payment when Yoco checkout is enabled, or contact support during the pilot for manual coordination.',
  },
  {
    q: 'How do I get dispatch updates?',
    a: 'When WhatsApp is configured, you receive status messages for payment, agent assignment, and report upload. In-app notifications are also available.',
  },
]

const commonIssues = [
  'Cannot see agent opportunities after payment — ensure payment status is paid and refresh the requests page.',
  'Report not yet available — agents upload after the briefing; allow up to 24 hours post-session.',
  'Wrong province on profile — update via SME or Agent onboarding or Settings.',
  'WhatsApp messages not received — confirm your number is in E.164 format (+27…) and joined to the Twilio sandbox during pilot.',
]

const channels = [
  {
    icon: MessageCircle,
    title: 'WhatsApp support',
    helper: 'Fastest during pilot hours',
    cta: 'Message us',
    href: WHATSAPP_URL,
    external: true,
    tone: 'gold' as const,
  },
  {
    icon: Mail,
    title: 'Email',
    helper: SUPPORT_EMAIL,
    cta: 'Send an email',
    href: `mailto:${SUPPORT_EMAIL}`,
    external: false,
    tone: 'navy' as const,
  },
  {
    icon: Phone,
    title: 'Phone',
    helper: '+27 10 013 3423 · Mon–Fri',
    cta: 'Call business hours',
    href: 'tel:+27100133423',
    external: false,
    tone: 'navy' as const,
  },
]

export default function SupportPage() {
  return (
    <MarketingPageLayout
      eyebrow="Support"
      title="We're here when procurement gets complicated."
      description="Reach our team for pilot launch support, briefing report questions, and agent verification enquiries."
    >
      <div className="grid gap-5 sm:grid-cols-3">
        {channels.map((c, i) => (
          <AnimateIn key={c.title} delay={i * 0.06}>
            <a
              href={c.href}
              target={c.external ? '_blank' : undefined}
              rel={c.external ? 'noopener noreferrer' : undefined}
              className={`group relative flex h-full flex-col overflow-hidden rounded-2xl border p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-card ${
                c.tone === 'gold'
                  ? 'border-accent-200 bg-gradient-to-br from-accent-50/60 to-white'
                  : 'border-brand-100 bg-white'
              }`}
            >
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-xl ring-1 ring-inset ${
                  c.tone === 'gold'
                    ? 'bg-accent-100 text-accent-700 ring-accent-200'
                    : 'bg-brand-50 text-brand-800 ring-brand-100'
                }`}
              >
                <c.icon className="h-6 w-6" />
              </div>
              <h2 className="mt-5 text-lg font-bold text-brand-900">{c.title}</h2>
              <p className="mt-1 text-sm text-slate-600">{c.helper}</p>
              <span className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-brand-800 group-hover:text-accent-600">
                {c.cta} <ArrowRight className="h-4 w-4" />
              </span>
            </a>
          </AnimateIn>
        ))}
      </div>

      <div className="mt-20 grid gap-10 lg:grid-cols-2">
        <AnimateIn>
          <div>
            <SectionLabel>FAQs</SectionLabel>
            <h2 className="mt-3 flex items-center gap-2 text-2xl font-bold text-brand-900">
              <HelpCircle className="h-6 w-6 text-accent-500" />
              Frequently asked questions
            </h2>
            <dl className="mt-8 space-y-3">
              {faqs.map((item) => (
                <details
                  key={item.q}
                  className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition open:border-brand-200 open:bg-brand-50/30"
                >
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
                    <span className="font-semibold text-brand-900">{item.q}</span>
                    <span className="mt-1 text-accent-500 transition group-open:rotate-90">
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">{item.a}</p>
                </details>
              ))}
            </dl>
          </div>
        </AnimateIn>
        <AnimateIn delay={0.08}>
          <div>
            <SectionLabel tone="gold">Troubleshooting</SectionLabel>
            <h2 className="mt-3 flex items-center gap-2 text-2xl font-bold text-brand-900">
              <AlertCircle className="h-6 w-6 text-accent-500" />
              Common issues
            </h2>
            <ul className="mt-8 space-y-3">
              {commonIssues.map((issue) => (
                <li
                  key={issue}
                  className="rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm leading-relaxed text-slate-700 shadow-sm"
                >
                  {issue}
                </li>
              ))}
            </ul>
            <p className="mt-8 rounded-xl border border-brand-100 bg-brand-50/40 px-5 py-4 text-sm text-slate-700">
              See also{' '}
              <Link href="/terms" className="font-semibold text-brand-800 hover:text-accent-600">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="font-semibold text-brand-800 hover:text-accent-600">
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </AnimateIn>
      </div>
    </MarketingPageLayout>
  )
}
