import type { Metadata } from 'next'
import Link from 'next/link'
import MarketingPageLayout from '@/components/marketing/MarketingPageLayout'
import AnimateIn from '@/components/ui/AnimateIn'
import { ATTENDANCE_FEE_LABEL } from '@/lib/payments/attendanceFee'
import { ArrowRight, Check } from 'lucide-react'

export const metadata: Metadata = {
  title: 'SME Pilot Programme',
  description:
    'Join the TenderBriefing SME pilot — we attend compulsory tender briefings on your behalf.',
}

const benefits = [
  'Free tender discovery from official government data',
  'Youth Agent attends compulsory briefings for you',
  'Structured briefing report for your bid team',
  'WhatsApp updates on dispatch and reports',
  'Pilot support from the TenderBriefing team',
]

const steps = [
  'Browse compulsory briefing tenders',
  'Request attendance support (R249 standard fee)',
  'Agent attends and uploads report',
  'You submit your tender through official channels',
]

export default function PilotSmePage() {
  return (
    <MarketingPageLayout
      eyebrow="SME pilot"
      title="We attend compulsory briefings for you"
      description="TenderBriefing connects your business with verified Youth Agents who attend tender briefings on your behalf — so you never miss compulsory sessions while building your bid."
    >
      <div className="grid gap-10 lg:grid-cols-2">
        <AnimateIn>
          <div className="rounded-2xl border border-brand-200 bg-brand-50/40 p-8">
            <h2 className="text-xl font-bold text-slate-900">Pilot benefits</h2>
            <ul className="mt-6 space-y-3">
              {benefits.map((b) => (
                <li key={b} className="flex gap-2 text-sm text-slate-700">
                  <Check className="h-4 w-4 shrink-0 text-brand-600" />
                  {b}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-slate-600">
              Attendance support fee: <strong>{ATTENDANCE_FEE_LABEL}</strong> per briefing during
              pilot. Card payment optional until Yoco is finalized.
            </p>
          </div>
        </AnimateIn>
        <AnimateIn delay={0.08}>
          <h2 className="text-xl font-bold text-slate-900">How it works</h2>
          <ol className="mt-6 space-y-4">
            {steps.map((s, i) => (
              <li key={s} className="flex gap-3 text-sm text-slate-700">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                  {i + 1}
                </span>
                {s}
              </li>
            ))}
          </ol>
          <p className="mt-6 text-sm text-slate-500">
            Final tender submission remains your responsibility through official government
            portals. TenderBriefing provides intelligence and attendance support only.
          </p>
        </AnimateIn>
      </div>

      <AnimateIn delay={0.12}>
        <div className="mt-12 flex flex-col items-center gap-4 rounded-2xl bg-brand-600 px-8 py-12 text-center">
          <h2 className="text-2xl font-bold text-white">Join the SME pilot</h2>
          <p className="max-w-lg text-brand-100">
            Register or complete onboarding to request your first briefing attendance.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/auth/signup?type=sme"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 font-semibold text-brand-800"
            >
              Create account
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href="/sme/onboarding"
              className="inline-flex items-center gap-2 rounded-xl border-2 border-white/40 px-8 py-4 font-semibold text-white"
            >
              Complete onboarding
            </Link>
          </div>
        </div>
      </AnimateIn>
    </MarketingPageLayout>
  )
}
