'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import AuthShell from '@/components/auth/AuthShell'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { Building2, Users } from 'lucide-react'
import { useAuth } from '@/components/providers/AuthProvider'
import { bootstrapGoogleProfile } from '@/lib/auth/continueWithGoogle'
import { toast } from 'react-hot-toast'

function RoleSelectionContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const googlePending = searchParams?.get('google') === '1'
  const { user, userProfile, loading } = useAuth()
  const [busy, setBusy] = useState<'sme' | 'youth-agent' | null>(null)

  useEffect(() => {
    if (!loading && googlePending && userProfile?.userType) {
      // Already has a role — never overwrite; send to their destination.
      if (userProfile.userType === 'youth-agent') router.replace('/agent/dashboard')
      else if (userProfile.userType === 'admin') router.replace('/admin/dashboard')
      else router.replace('/sme/dashboard')
    }
  }, [loading, googlePending, userProfile, router])

  const completeGoogleRole = async (role: 'sme' | 'youth-agent') => {
    if (!user) {
      router.push(`/auth/signup?type=${role}`)
      return
    }
    setBusy(role)
    try {
      const boot = await bootstrapGoogleProfile({
        intendedRole: role,
        registrationJourney: role,
      })
      if (!boot.success) {
        toast.error(boot.error || 'Could not save role')
        return
      }
      try {
        const { trackProductEvent } = await import('@/lib/founder/trackProductEvent')
        if (boot.data?.created) {
          await trackProductEvent('first_google_registration', {
            feature: 'auth',
            pagePath: '/auth/role-selection',
            metadata: { authenticationProvider: 'google', registrationJourney: role },
          })
        }
        if (boot.data?.onboardingRequired) {
          await trackProductEvent('onboarding_started', {
            feature: 'auth',
            pagePath: '/auth/role-selection',
            metadata: { authenticationProvider: 'google', registrationJourney: role },
          })
        }
      } catch {
        /* non-blocking */
      }
      toast.success('Continue onboarding to finish your profile')
      router.replace(boot.data?.redirectPath || (role === 'sme' ? '/sme/onboarding' : '/agent/onboarding'))
    } catch {
      toast.error('Could not complete registration')
    } finally {
      setBusy(null)
    }
  }

  if (loading && googlePending) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <AuthShell
      title={googlePending ? 'Choose your Tender Briefing path' : 'Register for TenderBriefing'}
      subtitle={
        googlePending
          ? 'Your Google account is signed in. Select SME or Youth Agent to finish setup. This choice cannot grant admin access.'
          : 'Choose how you will use the procurement operations platform.'
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          disabled={!!busy}
          onClick={() =>
            googlePending ? completeGoogleRole('sme') : router.push('/auth/signup?type=sme')
          }
          className="group rounded-xl border-2 border-slate-200 p-5 text-left transition hover:border-brand-500 hover:bg-brand-50 disabled:opacity-60"
        >
          <Building2 className="h-8 w-8 text-brand-600" />
          <h2 className="mt-3 font-bold text-slate-900">SME User</h2>
          <p className="mt-2 text-sm text-slate-600">
            Track compulsory briefings, request Youth Agent attendance, and manage briefing
            reports for your company.
          </p>
          <span className="mt-4 inline-block text-sm font-semibold text-brand-700 group-hover:underline">
            {busy === 'sme' ? 'Saving…' : googlePending ? 'Continue as SME →' : 'Register as SME →'}
          </span>
        </button>

        <button
          type="button"
          disabled={!!busy}
          onClick={() =>
            googlePending
              ? completeGoogleRole('youth-agent')
              : router.push('/auth/signup?type=youth-agent')
          }
          className="group rounded-xl border-2 border-slate-200 p-5 text-left transition hover:border-brand-500 hover:bg-brand-50 disabled:opacity-60"
        >
          <Users className="h-8 w-8 text-brand-600" />
          <h2 className="mt-3 font-bold text-slate-900">Youth Agent</h2>
          <p className="mt-2 text-sm text-slate-600">
            Accept briefing assignments, attend site meetings, and submit official Briefing
            Reports for SMEs.
          </p>
          <span className="mt-4 inline-block text-sm font-semibold text-brand-700 group-hover:underline">
            {busy === 'youth-agent'
              ? 'Saving…'
              : googlePending
                ? 'Continue as Youth Agent →'
                : 'Register as Youth Agent →'}
          </span>
        </button>
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

export default function RoleSelectionPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <LoadingSpinner size="lg" />
        </div>
      }
    >
      <RoleSelectionContent />
    </Suspense>
  )
}
