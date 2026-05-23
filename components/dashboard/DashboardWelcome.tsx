'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { UserProfile } from '@/lib/auth'

interface DashboardWelcomeProps {
  userProfile: UserProfile | null
  email?: string | null
}

export default function DashboardWelcome({ userProfile, email }: DashboardWelcomeProps) {
  const isAgent = userProfile?.userType === 'youth-agent'
  const companyName =
    userProfile?.companyName || userProfile?.displayName || email?.split('@')[0] || 'there'

  if (isAgent) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-600 to-brand-800 p-8 text-white shadow-card lg:p-10">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <p className="text-sm font-medium text-brand-100">Youth Agent Dashboard</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Let&apos;s make money by attending meetings.
        </h1>
        <p className="mt-3 max-w-xl text-brand-100">
          Review nearby briefing assignments, accept opportunities, and submit professional
          reports to grow your rating.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/jobs"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-brand-800 hover:bg-brand-50"
          >
            View available jobs
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-8 shadow-card lg:p-10">
      <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full bg-brand-50 blur-2xl" />
      <p className="text-sm font-semibold text-brand-700">SME Dashboard</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
        Welcome back, {companyName}.
        <br />
        <span className="text-brand-600">Let&apos;s Make Today Count.</span>
      </h1>
      <p className="mt-3 max-w-xl text-slate-600">
        Track compulsory briefings, request Youth Agents, and stay ahead of procurement
        deadlines across South Africa.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/tenders"
          className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Browse opportunities
          <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          href="/sme/requests"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:border-brand-200 hover:bg-brand-50"
        >
          My Attendance Requests
        </Link>
      </div>
    </div>
  )
}

