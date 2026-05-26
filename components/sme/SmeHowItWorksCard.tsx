'use client'

import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import { ATTENDANCE_FEE_LABEL } from '@/lib/payments/attendanceFee'

const STEPS = [
  'Browse opportunities for free',
  'Get matched to relevant tenders based on your categories and commodities',
  'Track compulsory briefings',
  'Request a verified Youth Agent',
  `Fixed fee: ${ATTENDANCE_FEE_LABEL} per briefing attended`,
]

export default function SmeHowItWorksCard() {
  return (
    <section className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">
            Free for SMEs
          </p>
          <h2 className="text-lg font-bold text-slate-900">How TenderBriefing Works</h2>
        </div>
        <Link
          href="/tenders"
          className="mt-2 text-sm font-semibold text-brand-700 hover:underline sm:mt-0"
        >
          Browse tenders →
        </Link>
      </div>
      <ul className="mt-4 space-y-3">
        {STEPS.map((step) => (
          <li key={step} className="flex items-start gap-3 text-sm text-slate-700">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
            <span>{step}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
