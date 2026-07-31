'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/providers/AuthProvider'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { onboardingPathForRole } from '@/lib/auth/googleAuthFlow'

/**
 * Client gate: SME / youth-agent dashboards require onboardingCompleted === true.
 * Admins are not redirected through onboarding.
 */
export default function RequireCompletedOnboarding({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, userProfile, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace('/auth/signin')
      return
    }
    if (!userProfile) return

    if (
      userProfile.onboardingCompleted !== true &&
      (userProfile.userType === 'sme' || userProfile.userType === 'youth-agent')
    ) {
      router.replace(onboardingPathForRole(userProfile.userType))
    }
  }, [user, userProfile, loading, router])

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (
    userProfile &&
    userProfile.onboardingCompleted !== true &&
    (userProfile.userType === 'sme' || userProfile.userType === 'youth-agent')
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return <>{children}</>
}
