'use client'

import Link from 'next/link'
import AuthShell from '@/components/auth/AuthShell'
import { Building2, Users } from 'lucide-react'

export default function RoleSelectionPage() {
  return (
    <AuthShell
      title="Register for TenderBriefing"
      subtitle="Choose how you will use the procurement operations platform."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/auth/signup?type=sme"
          className="group rounded-xl border-2 border-slate-200 p-5 transition hover:border-brand-500 hover:bg-brand-50"
        >
          <Building2 className="h-8 w-8 text-brand-600" />
          <h2 className="mt-3 font-bold text-slate-900">SME User</h2>
          <p className="mt-2 text-sm text-slate-600">
            Track compulsory briefings, request Youth Agent attendance, and manage briefing
            reports for your company.
          </p>
          <span className="mt-4 inline-block text-sm font-semibold text-brand-700 group-hover:underline">
            Register as SME →
          </span>
        </Link>

        <Link
          href="/auth/signup?type=youth-agent"
          className="group rounded-xl border-2 border-slate-200 p-5 transition hover:border-brand-500 hover:bg-brand-50"
        >
          <Users className="h-8 w-8 text-brand-600" />
          <h2 className="mt-3 font-bold text-slate-900">Youth Agent</h2>
          <p className="mt-2 text-sm text-slate-600">
            Accept briefing assignments, attend site meetings, and submit official Briefing
            Reports for SMEs.
          </p>
          <span className="mt-4 inline-block text-sm font-semibold text-brand-700 group-hover:underline">
            Register as Youth Agent →
          </span>
        </Link>
      </div>

      <p className="mt-6 text-center text-sm text-slate-600">
        Already registered?{' '}
        <Link href="/auth/signin" className="font-semibold text-brand-700 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  )
}
