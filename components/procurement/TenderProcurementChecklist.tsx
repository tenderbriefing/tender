'use client'

import { CheckCircle2, Circle } from 'lucide-react'

const CHECKLIST_ITEMS = [
  'Download tender documents',
  'Confirm compulsory briefing details',
  'Request attendance support',
  'Prepare compliance documents',
  'Prepare quotation / bid response',
  'Submit through official channels',
] as const

export default function TenderProcurementChecklist() {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900">Procurement Checklist</h2>
      <p className="mt-1 text-sm text-slate-600">
        Use this checklist to prepare your bid response. TenderBriefing supports discovery and
        briefing attendance — final submission remains your responsibility.
      </p>
      <ul className="mt-4 space-y-3">
        {CHECKLIST_ITEMS.map((item, index) => (
          <li key={item} className="flex items-start gap-3 text-sm text-slate-700">
            {index < 2 ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden />
            ) : (
              <Circle className="mt-0.5 h-5 w-5 shrink-0 text-slate-300" aria-hidden />
            )}
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
