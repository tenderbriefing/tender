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

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">

        <p className="procurement-kicker">Youth Agent dashboard</p>

        <h1 className="procurement-page-header mt-2">Briefing assignment queue</h1>

        <p className="mt-3 max-w-2xl text-sm text-slate-600 sm:text-base">

          Review open compulsory briefing sessions, accept assignments within your service area,

          and submit Briefing Reports with attendance proof for SMEs.

        </p>

        <div className="mt-6 flex flex-wrap gap-3">

          <Link

            href="/jobs"

            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"

          >

            View briefing assignments

            <ArrowRight className="h-4 w-4" aria-hidden />

          </Link>

        </div>

      </div>

    )

  }



  return (

    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">

      <p className="procurement-kicker">SME dashboard</p>

      <h1 className="procurement-page-header mt-2">Welcome, {companyName}</h1>

      <p className="mt-3 max-w-2xl text-sm text-slate-600 sm:text-base">

        Monitor compulsory briefing deadlines, request Youth Agent attendance, and track

        Briefing Reports from official government tender data.

      </p>

      <div className="mt-6 flex flex-wrap gap-3">

        <Link

          href="/tenders"

          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"

        >

          Browse tender opportunities

          <ArrowRight className="h-4 w-4" aria-hidden />

        </Link>

        <Link

          href="/sme/requests"

          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:border-brand-200 hover:bg-brand-50"

        >

          My attendance requests

        </Link>

      </div>

    </div>

  )

}


