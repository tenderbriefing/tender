'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/providers/AuthProvider'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, userProfile, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace('/auth/signin?next=/admin/dashboard')
      return
    }
    if (userProfile?.userType !== 'admin') {
      router.replace('/dashboard')
    }
  }, [user, userProfile, loading, router])

  if (loading || !user || userProfile?.userType !== 'admin') {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return <>{children}</>
}
