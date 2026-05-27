'use client'

import Link from 'next/link'
import { ArrowLeft, Building2, Calendar, MapPin, ShieldCheck } from 'lucide-react'
import type { TenderBriefing } from '@/lib/tenderBriefing/types'
import {
  countdownLabel,
  daysUntil,
  formatProcurementDate,
  formatProcurementDateTime,
} from '@/lib/procurement/dates'
import { getTenderDisplayStatus } from '@/lib/procurement/tenderStatus'
import { getOfficialEtendersScope } from '@/lib/procurement/tenderDescription'

function UrgencyChip({ tender }: { tender: TenderBriefing }) {
  const status = getTenderDisplayStatus(tender)
  const closingDays = daysUntil(tender.closingDate)
  const briefingDays = daysUntil(tender.briefingDate)

  if (status === 'closed') {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-red-500/15 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-red-300 ring-1 ring-inset ring-red-400/40">
        <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
        Closed
      </span>
    )
  }

  if (status === 'closing_soon' && closingDays !== null) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-red-500/15 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-red-200 ring-1 ring-inset ring-red-400/40">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-300" />
        Closing in {countdownLabel(tender.closingDate)}
      </span>
    )
  }

  if (briefingDays !== null && briefingDays >= 0 && briefingDays <= 7) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-accent-500/20 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-accent-300 ring-1 ring-inset ring-accent-400/40">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-400" />
        Briefing in {countdownLabel(tender.briefingDate)}
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-emerald-300 ring-1 ring-inset ring-emerald-400/40">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
      Open opportunity
    </span>
  )
}

export default function TenderHero({ tender }: { tender: TenderBriefing }) {
  const closingDays = daysUntil(tender.closingDate)
  const briefingDays = daysUntil(tender.briefingDate)
  const officialScope = getOfficialEtendersScope(tender)

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-brand-900 via-brand-800 to-brand-950 text-white">
      <div className="pointer-events-none absolute -top-32 -right-24 h-72 w-72 rounded-full bg-accent-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-brand-500/30 blur-3xl" />
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.08]"
      >
        <defs>
          <pattern id="tender-hero-grid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M0 32V0h32" fill="none" stroke="#D4AF37" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#tender-hero-grid)" />
      </svg>

      <div className="relative mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-14">
        <Link
          href="/tenders"
          className="inline-flex items-center gap-2 text-sm font-medium text-brand-100/80 transition hover:text-accent-400"
        >
          <ArrowLeft className="h-4 w-4" />
          All tender opportunities
        </Link>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <UrgencyChip tender={tender} />
          {tender.briefingCompulsory && (
            <span className="inline-flex items-center gap-2 rounded-full bg-accent-500 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-brand-900">
              <ShieldCheck className="h-3.5 w-3.5" />
              Compulsory briefing
            </span>
          )}
          {tender.industrySector && (
            <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-inset ring-white/15">
              {tender.industrySector}
            </span>
          )}
        </div>

        <p className="mt-6 font-mono text-sm font-bold text-accent-300">
          {tender.tenderNumber || 'Tender number pending'}
        </p>
        <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-[2.75rem]">
          {officialScope || tender.title}
        </h1>
        {officialScope && tender.title && tender.title.trim() !== officialScope.trim() && (
          <p className="mt-2 text-sm font-medium text-brand-100/75">
            Tender reference: {tender.title}
          </p>
        )}

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl bg-white/5 px-4 py-3 ring-1 ring-inset ring-white/10">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-accent-400">
              <Building2 className="h-3.5 w-3.5" />
              Department
            </div>
            <p className="mt-1.5 text-sm font-semibold text-white line-clamp-2">
              {tender.department || 'Department unavailable'}
            </p>
          </div>
          <div className="rounded-xl bg-white/5 px-4 py-3 ring-1 ring-inset ring-white/10">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-accent-400">
              <MapPin className="h-3.5 w-3.5" />
              Province
            </div>
            <p className="mt-1.5 text-sm font-semibold text-white">
              {tender.province || 'Not specified'}
            </p>
          </div>
          <div className="rounded-xl bg-white/5 px-4 py-3 ring-1 ring-inset ring-white/10">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-accent-400">
              <Calendar className="h-3.5 w-3.5" />
              Closing
            </div>
            <p className="mt-1.5 text-sm font-semibold text-white">
              {formatProcurementDate(tender.closingDate)}
            </p>
            {closingDays !== null && closingDays >= 0 && (
              <p className="text-[11px] text-brand-100/70">
                {countdownLabel(tender.closingDate)} remaining
              </p>
            )}
          </div>
          <div className="rounded-xl bg-white/5 px-4 py-3 ring-1 ring-inset ring-white/10">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-accent-400">
              <Calendar className="h-3.5 w-3.5" />
              Briefing date & time
            </div>
            <p className="mt-1.5 text-sm font-semibold text-white">
              {tender.briefingDate
                ? formatProcurementDateTime(tender.briefingDate, tender.briefingTime)
                : 'TBC'}
            </p>
            {briefingDays !== null && briefingDays >= 0 && (
              <p className="text-[11px] text-brand-100/70">
                {countdownLabel(tender.briefingDate)} away
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
