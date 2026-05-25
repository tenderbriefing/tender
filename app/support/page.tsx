import type { Metadata } from 'next'
import Link from 'next/link'
import MarketingPageLayout from '@/components/marketing/MarketingPageLayout'
import AnimateIn from '@/components/ui/AnimateIn'
import { Mail, MessageCircle, Phone } from 'lucide-react'

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

export default function SupportPage() {
  return (
    <MarketingPageLayout
      eyebrow="Support"
      title="Help centre for SMEs and Youth Agents"
      description="Reach our team for pilot launch support, briefing report questions, and agent verification enquiries."
    >
      <div className="grid gap-6 sm:grid-cols-3">
        <AnimateIn>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center rounded-2xl border border-brand-200 bg-brand-50/50 p-6 text-center transition hover:border-brand-400 hover:shadow-md"
          >
            <MessageCircle className="h-10 w-10 text-brand-600" />
            <h2 className="mt-4 font-bold text-slate-900">WhatsApp support</h2>
            <p className="mt-2 text-sm text-slate-600">Fastest during pilot hours</p>
            <span className="mt-4 text-sm font-semibold text-brand-700">Message us →</span>
          </a>
        </AnimateIn>
        <AnimateIn delay={0.06}>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm transition hover:border-brand-300"
          >
            <Mail className="h-10 w-10 text-brand-600" />
            <h2 className="mt-4 font-bold text-slate-900">Email</h2>
            <p className="mt-2 text-sm text-slate-600">{SUPPORT_EMAIL}</p>
          </a>
        </AnimateIn>
        <AnimateIn delay={0.12}>
          <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
            <Phone className="h-10 w-10 text-brand-600" />
            <h2 className="mt-4 font-bold text-slate-900">Phone</h2>
            <p className="mt-2 text-sm text-slate-600">+27 10 013 3423</p>
            <p className="mt-1 text-xs text-slate-500">Mon–Fri, business hours</p>
          </div>
        </AnimateIn>
      </div>

      <div className="mt-16 grid gap-10 lg:grid-cols-2">
        <AnimateIn>
          <h2 className="text-xl font-bold text-slate-900">Frequently asked questions</h2>
          <dl className="mt-6 space-y-6">
            {faqs.map((item) => (
              <div key={item.q}>
                <dt className="font-semibold text-slate-900">{item.q}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-slate-600">{item.a}</dd>
              </div>
            ))}
          </dl>
        </AnimateIn>
        <AnimateIn delay={0.08}>
          <h2 className="text-xl font-bold text-slate-900">Common issues</h2>
          <ul className="mt-6 space-y-4">
            {commonIssues.map((issue) => (
              <li
                key={issue}
                className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700"
              >
                {issue}
              </li>
            ))}
          </ul>
          <p className="mt-8 text-sm text-slate-600">
            See also{' '}
            <Link href="/terms" className="font-semibold text-brand-700 hover:underline">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="font-semibold text-brand-700 hover:underline">
              Privacy Policy
            </Link>
            .
          </p>
        </AnimateIn>
      </div>
    </MarketingPageLayout>
  )
}
