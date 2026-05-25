'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ProcurementPageHeader from '@/components/procurement/ProcurementPageHeader'
import { useAuth } from '@/components/providers/AuthProvider'

export default function AdminOpsPageShell({
  kicker,
  title,
  description,
  breadcrumb,
  children,
}: {
  kicker: string
  title: string
  description: string
  breadcrumb?: { label: string; href: string }
  children: React.ReactNode
}) {
  const { user, userProfile, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      if (!user) router.push('/auth/signin')
      else if (userProfile?.userType !== 'admin') router.push('/dashboard')
    }
  }, [user, userProfile, loading, router])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <LoadingSpinner size="lg" />
      </div>
    )
  }
  if (!user || userProfile?.userType !== 'admin') return null

  return (
    <div className="procurement-shell">
      <Header />
      <ProcurementPageHeader
        kicker={kicker}
        title={title}
        description={description}
        breadcrumb={breadcrumb || { label: 'Operations', href: '/admin/operations' }}
      />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      <Footer />
    </div>
  )
}
