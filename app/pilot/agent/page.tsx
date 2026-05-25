import type { Metadata } from 'next'
import Link from 'next/link'
import MarketingPageLayout from '@/components/marketing/MarketingPageLayout'
import AnimateIn from '@/components/ui/AnimateIn'
import { ArrowRight, Check } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Youth Agent Pilot',
  description:
    'Join the TenderBriefing Youth Agent pilot — earn by attending compulsory tender briefings.',
}

const requirements = [
  '18+ with reliable transport (where possible)',
  'Based in South Africa — all provinces needed',
  'Professional conduct at briefing venues',
  'Upload structured reports within 24 hours',
  'Accept platform code of conduct',
]

const expectations = [
  'Platinum / Gold / Silver / At Risk tiers based on performance',
  'Fast acceptance improves dispatch priority',
  'Missed briefings reduce reliability score',
  'SME ratings and report quality affect your tier',
]

export default function PilotAgentPage() {
  return (
    <MarketingPageLayout
      eyebrow="Youth Agent pilot"
      title="Earn by attending tender briefings"
      description="Represent SMEs at compulsory government tender briefings, submit digital reports, and build a nationwide reliability reputation."
    >
      <div className="grid gap-10 lg:grid-cols-2">
        <AnimateIn>
          <h2 className="text-xl font-bold text-slate-900">Requirements</h2>
          <ul className="mt-6 space-y-3">
            {requirements.map((r) => (
              <li key={r} className="flex gap-2 text-sm text-slate-700">
                <Check className="h-4 w-4 shrink-0 text-brand-600" />
                {r}
              </li>
            ))}
          </ul>
          <p className="mt-6 rounded-lg border border-amber-100 bg-amber-50 p-4 text-sm text-amber-900">
            <strong>Provinces needed:</strong> Gauteng, KwaZulu-Natal, Western Cape, Eastern Cape,
            Limpopo, Mpumalanga, Free State, North West, Northern Cape — pilot filling gaps
            nationwide.
          </p>
        </AnimateIn>
        <AnimateIn delay={0.08}>
          <h2 className="text-xl font-bold text-slate-900">Reliability expectations</h2>
          <ul className="mt-6 space-y-3">
            {expectations.map((e) => (
              <li key={e} className="text-sm text-slate-700">
                {e}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-slate-600">
            ID verification is completed during pilot review. You will start as{' '}
            <em>pending verification</em> until admin approval.
          </p>
        </AnimateIn>
      </div>

      <AnimateIn delay={0.12}>
        <div className="mt-12 flex flex-col items-center gap-4 rounded-2xl bg-brand-600 px-8 py-12 text-center">
          <h2 className="text-2xl font-bold text-white">Join Agent Pilot</h2>
          <p className="max-w-lg text-brand-100">
            Free registration. Paid assignments dispatched to top-rated nearby agents.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/auth/signup?type=youth-agent"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 font-semibold text-brand-800"
            >
              Create account
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href="/agent/onboarding"
              className="inline-flex items-center gap-2 rounded-xl border-2 border-white/40 px-8 py-4 font-semibold text-white"
            >
              Complete onboarding
            </Link>
          </div>
          <Link href="/terms" className="text-sm text-brand-100 underline">
            Code of conduct & terms
          </Link>
        </div>
      </AnimateIn>
    </MarketingPageLayout>
  )
}
