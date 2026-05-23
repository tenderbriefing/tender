'use client'

import { useAuth } from '@/components/providers/AuthProvider'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

export default function DashboardRedirectPage() {
  const { user, userProfile, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace('/auth/signin')
      return
    }
    if (userProfile?.userType === 'youth-agent') {
      router.replace('/agent/dashboard')
    } else if (userProfile?.userType === 'admin') {
      router.replace('/admin/dashboard')
    } else {
      router.replace('/sme/dashboard')
    }
  }, [user, userProfile, loading, router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <LoadingSpinner size="lg" />
    </div>
  )
}
