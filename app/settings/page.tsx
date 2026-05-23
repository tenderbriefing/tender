'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { useAuth } from '@/components/providers/AuthProvider'
import Link from 'next/link'

export default function SettingsPage() {
  const { user, userProfile, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) router.push('/auth/signin')
  }, [loading, user, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <div className="mt-6 bg-white rounded-2xl border p-6 space-y-4">
          <div>
            <p className="text-sm text-gray-500">Account</p>
            <p className="font-medium">{userProfile?.displayName}</p>
            <p className="text-sm text-gray-600">{user?.email}</p>
            <p className="text-sm text-purple-600 capitalize mt-1">
              {userProfile?.userType?.replace('-', ' ')}
            </p>
          </div>
          <Link href="/profile" className="text-purple-600 text-sm">
            Edit profile →
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  )
}
