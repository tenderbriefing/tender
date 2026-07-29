'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/components/providers/AuthProvider'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

export default function AdminAuthGuard({ children }: { children: React.ReactNode }) {
  const { user, userProfile, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (loading) return
    if (!user) {
      const target = pathname?.startsWith('/admin') ? pathname : '/admin/dashboard'
      router.replace(`/auth/signin?redirect=${encodeURIComponent(target)}`)
      return
    }
    if (userProfile?.userType !== 'admin') {
      router.replace('/dashboard')
    }
  }, [user, userProfile, loading, router, pathname])

  if (loading || !user || userProfile?.userType !== 'admin') {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return <>{children}</>
}
