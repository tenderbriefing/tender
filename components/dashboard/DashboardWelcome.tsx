'use client'

import Link from 'next/link'
import { ArrowRight, Briefcase, ClipboardList, FileText, Sparkles, Users } from 'lucide-react'
import type { UserProfile } from '@/lib/auth'

interface DashboardWelcomeProps {
  userProfile: UserProfile | null
  email?: string | null
}

const SHARED_HERO_BG =
  'relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-900 via-brand-800 to-brand-950 text-white shadow-card'

function HeroDecor() {
  return (
    <>
      <div className="pointer-events-none absolute -top-24 -right-20 h-56 w-56 rounded-full bg-accent-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-20 h-56 w-56 rounded-full bg-brand-500/30 blur-3xl" />
      <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.08]">
        <defs>
          <pattern id="welcome-grid" width="28" height="28" patternUnits="userSpaceOnUse">
            <path d="M0 28V0h28" fill="none" stroke="#D4AF37" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#welcome-grid)" />
      </svg>
    </>
  )
}

export default function DashboardWelcome({ userProfile, email }: DashboardWelcomeProps) {
  const isAgent = userProfile?.userType === 'youth-agent'

  const companyName =
    userProfile?.companyName || userProfile?.displayName || email?.split('@')[0] || 'there'

  if (isAgent) {
    return (
      <div className={`${SHARED_HERO_BG} p-6 sm:p-10`}>
        <HeroDecor />
        <div className="relative">
          <span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-accent-400">
            <span className="h-1.5 w-6 rounded-full bg-accent-500" />
            Youth Agent dashboard
          </span>
          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
            Welcome, <span className="text-accent-400">{userProfile?.displayName || 'Agent'}</span>
          </h1>
          <p className="mt-3 max-w-2xl text-base text-brand-100/80">
            Review open compulsory briefing assignments in your service area, accept dispatches,
            and submit Briefing Reports with attendance proof.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/jobs"
              className="inline-flex items-center gap-2 rounded-xl bg-accent-500 px-5 py-3 text-sm font-bold text-brand-900 shadow-gold transition hover:bg-accent-400"
            >
              <Briefcase className="h-4 w-4" />
              View briefing assignments
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/briefing-reports/upload"
              className="inline-flex items-center gap-2 rounded-xl border border-white/30 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              <FileText className="h-4 w-4" />
              Upload a report
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`${SHARED_HERO_BG} p-6 sm:p-10`}>
      <HeroDecor />
      <div className="relative">
        <span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-accent-400">
          <span className="h-1.5 w-6 rounded-full bg-accent-500" />
          SME dashboard
        </span>
        <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
          Welcome, <span className="text-accent-400">{companyName}</span>
        </h1>
        <p className="mt-3 max-w-2xl text-base text-brand-100/80">
          Monitor compulsory briefing deadlines, request Youth Agent attendance, and track
          Briefing Reports — all from one procurement command center.
        </p>

        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            href="/tenders"
            className="inline-flex items-center gap-2 rounded-xl bg-accent-500 px-5 py-3 text-sm font-bold text-brand-900 shadow-gold transition hover:bg-accent-400"
          >
            <Sparkles className="h-4 w-4" />
            Browse tender opportunities
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/sme/requests"
            className="inline-flex items-center gap-2 rounded-xl border border-white/30 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            <ClipboardList className="h-4 w-4" />
            My attendance requests
          </Link>
          <Link
            href="/sme/rfq-inbox"
            className="inline-flex items-center gap-2 rounded-xl border border-white/30 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            <Users className="h-4 w-4" />
            RFQ inbox
          </Link>
        </div>
      </div>
    </div>
  )
}
