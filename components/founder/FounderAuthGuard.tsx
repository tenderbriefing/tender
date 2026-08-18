'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/components/providers/AuthProvider'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import {
  evaluateFounderAccess,
  isFounderIntelligenceEnabledClient,
} from '@/lib/founder/access'

export default function FounderAuthGuard({ children }: { children: React.ReactNode }) {
  const { user, userProfile, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  const enabled = isFounderIntelligenceEnabledClient()
  const decision = evaluateFounderAccess({
    enabled,
    authenticated: Boolean(user),
    userType: userProfile?.userType,
    email: user?.email || userProfile?.email,
    founderAccess: (userProfile as { founderAccess?: boolean } | null)?.founderAccess === true,
  })

  useEffect(() => {
    if (loading) return
    if (!enabled) {
      router.replace('/admin/dashboard')
      return
    }
    if (!user) {
      router.replace(
        `/auth/signin?redirect=${encodeURIComponent(pathname || '/founder')}`
      )
      return
    }
    if (!decision.ok) {
      router.replace('/admin/dashboard')
    }
  }, [loading, enabled, user, decision.ok, router, pathname])

  if (loading || !user || !decision.ok) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return <>{children}</>
}
