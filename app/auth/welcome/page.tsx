'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import AuthShell from '@/components/auth/AuthShell'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { useAuth } from '@/components/providers/AuthProvider'
import {
  clearPostRegistrationWelcomePending,
  consumePostRegistrationWelcomePending,
  dashboardPathFromTrustedProfile,
  isWelcomeRole,
  welcomeCopyForRole,
} from '@/lib/auth/postRegistrationWelcome'

function WelcomeContent() {
  const router = useRouter()
  const { user, userProfile, loading } = useAuth()
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    if (loading || allowed) return

    if (!user) {
      clearPostRegistrationWelcomePending()
      router.replace('/auth/signin')
      return
    }

    if (!userProfile?.userType) {
      clearPostRegistrationWelcomePending()
      router.replace('/auth/role-selection?recover=1')
      return
    }

    if (!isWelcomeRole(userProfile.userType)) {
      clearPostRegistrationWelcomePending()
      router.replace(dashboardPathFromTrustedProfile(userProfile.userType))
      return
    }

    if (!consumePostRegistrationWelcomePending(user.uid)) {
      router.replace(dashboardPathFromTrustedProfile(userProfile.userType))
      return
    }

    setAllowed(true)
  }, [loading, allowed, user, userProfile, router])

  if (loading || !allowed || !userProfile || !isWelcomeRole(userProfile.userType)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  const copy = welcomeCopyForRole(userProfile.userType)
  const dashboardHref = dashboardPathFromTrustedProfile(userProfile.userType)

  return (
    <AuthShell title={copy.title} subtitle={copy.body}>
      <div className="flex flex-col items-stretch gap-6">
        <div
          className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900"
          role="status"
        >
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
          <p className="font-medium leading-relaxed">Registration successful</p>
        </div>

        <button
          type="button"
          onClick={() => {
            clearPostRegistrationWelcomePending()
            router.replace(dashboardHref)
          }}
          className="flex w-full items-center justify-center rounded-xl bg-brand-800 py-3.5 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-800"
        >
          {copy.ctaLabel}
        </button>
      </div>
    </AuthShell>
  )
}

export default function PostRegistrationWelcomePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <LoadingSpinner size="lg" />
        </div>
      }
    >
      <WelcomeContent />
    </Suspense>
  )
}
