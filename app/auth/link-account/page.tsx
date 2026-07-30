'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { getAuthErrorMessage, normalizeAuthEmail } from '@/lib/auth/errors'
import {
  continueWithGoogle,
  bootstrapGoogleProfile,
} from '@/lib/auth/continueWithGoogle'
import { signInWithPasswordAndLinkGoogle } from '@/lib/auth/googleAuth'
import { toast } from 'react-hot-toast'
import AuthShell from '@/components/auth/AuthShell'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-slate-900 placeholder:text-slate-400 transition focus:border-brand-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-700/20'

function LinkAccountForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialEmail = searchParams?.get('email') || ''

  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      toast.error('Email and password are required to prove account ownership.')
      return
    }
    setLoading(true)
    try {
      const { linked, linkMessage } = await signInWithPasswordAndLinkGoogle(
        normalizeAuthEmail(email),
        password
      )
      if (!linked) {
        toast.error(linkMessage || 'Signed in, but Google could not be linked. Try again from settings later.')
      } else {
        toast.success('Google linked to your account')
      }
      const boot = await bootstrapGoogleProfile({ registrationJourney: 'signin' })
      if (!boot.success) {
        toast.error(boot.error || 'Could not load profile')
        return
      }
      router.replace(boot.data?.redirectPath || '/sme/dashboard')
    } catch (error: unknown) {
      toast.error(getAuthErrorMessage(error, 'Could not link Google to this account.'))
    } finally {
      setLoading(false)
    }
  }

  const tryGoogleAgain = async () => {
    setLoading(true)
    try {
      const result = await continueWithGoogle({
        registrationJourney: 'signin',
        pagePath: '/auth/link-account',
      })
      if (result.ok) {
        router.replace(result.redirectPath || '/sme/dashboard')
        return
      }
      if (result.message) toast.error(result.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title="Link Google to your account"
      subtitle="This email already has a Tender Briefing password account. Sign in with your password to securely link Google — we never merge accounts without proving ownership."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-slate-700">Email</label>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`mt-1 ${inputClass}`}
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700">Password</label>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`mt-1 ${inputClass}`}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-800 py-3.5 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? <LoadingSpinner size="sm" /> : 'Sign in & link Google'}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-slate-600">
        <button
          type="button"
          onClick={tryGoogleAgain}
          className="font-semibold text-brand-800 hover:underline"
          disabled={loading}
        >
          Try Google again
        </button>
        {' · '}
        <Link href="/auth/signin" className="font-semibold text-brand-800 hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  )
}

export default function LinkAccountPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <LoadingSpinner size="lg" />
        </div>
      }
    >
      <LinkAccountForm />
    </Suspense>
  )
}
