'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/providers/AuthProvider'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { authFetch } from '@/lib/api/authenticatedFetch'
import Link from 'next/link'

type AccessState = 'loading' | 'allowed' | 'denied' | 'signed-out'

/**
 * Gates workspace pages: auth + server feature flag (fail-closed).
 */
export default function WorkspaceGate({ children }: { children: React.ReactNode }) {
  const { user, userProfile, loading } = useAuth()
  const router = useRouter()
  const [access, setAccess] = useState<AccessState>('loading')

  const probe = useCallback(async () => {
    if (!user) {
      setAccess('signed-out')
      return
    }
    if (userProfile && userProfile.userType !== 'youth-agent' && userProfile.userType !== 'admin') {
      setAccess('denied')
      return
    }
    try {
      const res = await authFetch('/api/agent/workspace')
      const json = await res.json()
      if (json?.data?.enabled) setAccess('allowed')
      else setAccess('denied')
    } catch {
      setAccess('denied')
    }
  }, [user, userProfile])

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.push('/auth/signin?next=/agent/workspace/today')
      setAccess('signed-out')
      return
    }
    void probe()
  }, [loading, user, probe, router])

  if (loading || access === 'loading') {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (access === 'denied') {
    return (
      <div className="mx-auto flex min-h-[100dvh] max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-xl font-bold text-slate-900">Workspace unavailable</h1>
        <p className="text-sm text-slate-600">
          Youth Agent Workspace is not enabled for this account yet. Use the classic field app in
          the meantime.
        </p>
        <Link
          href="/agent/mobile/dispatch"
          className="inline-flex min-h-[44px] items-center rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white"
        >
          Open field app
        </Link>
        <Link href="/agent/dashboard" className="text-sm font-medium text-brand-700 underline">
          Agent dashboard
        </Link>
      </div>
    )
  }

  return <>{children}</>
}
