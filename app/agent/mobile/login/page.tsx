'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/components/providers/AuthProvider'
import { signIn, getUserProfile } from '@/lib/auth'
import { getAuthErrorMessage, normalizeAuthEmail } from '@/lib/auth/errors'
import { toast } from 'react-hot-toast'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import MobileShell from '@/components/agent/mobile/MobileShell'

export default function AgentMobileLoginPage() {
  const { user, userProfile, loading } = useAuth()
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ email: '', password: '' })

  useEffect(() => {
    if (!loading && user && userProfile?.userType === 'youth-agent') {
      router.replace('/agent/mobile/dispatch')
    }
  }, [user, userProfile, loading, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const { user: u } = await signIn(normalizeAuthEmail(form.email), form.password)
      const profile = await getUserProfile(u.uid)
      if (profile?.userType !== 'youth-agent') {
        toast.error('Youth agent account required')
        return
      }
      toast.success('Signed in')
      router.replace('/agent/mobile/dispatch')
    } catch (err) {
      toast.error(getAuthErrorMessage(err, 'Sign-in failed'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <MobileShell title="Agent sign-in">
      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">
          Sign in with your Firebase agent account. Session stays active for field work offline.
        </p>
        <div>
          <label className="text-sm font-semibold text-slate-700">Email</label>
          <input
            type="email"
            required
            autoComplete="email"
            value={form.email}
            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-slate-200 px-4 py-3 text-base"
          />
        </div>
        <div>
          <label className="text-sm font-semibold text-slate-700">Password</label>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={form.password}
            onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-slate-200 px-4 py-3 text-base"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="w-full min-h-[48px] rounded-xl bg-brand-600 font-semibold text-white disabled:opacity-60"
        >
          {submitting ? 'Signing in…' : 'Continue to dispatch'}
        </button>
        <Link href="/auth/signin?redirect=/agent/mobile/dispatch" className="block text-center text-sm text-brand-700">
          Full web sign-in
        </Link>
      </form>
    </MobileShell>
  )
}
