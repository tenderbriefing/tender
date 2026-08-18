'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { signIn, getUserProfile } from '@/lib/auth'
import { getAuthErrorMessage, normalizeAuthEmail } from '@/lib/auth/errors'
import { homePathForProfile } from '@/lib/auth/redirects'
import { resolvePostAuthDestination } from '@/lib/auth/googleAuthFlow'
import {
  continueWithGoogle,
  finishGoogleRedirect,
} from '@/lib/auth/continueWithGoogle'
import { isGoogleAuthEnabled } from '@/lib/auth/googleAuthEnabled'
import { toast } from 'react-hot-toast'
import AuthShell from '@/components/auth/AuthShell'
import GoogleContinueButton, {
  AuthMethodDivider,
} from '@/components/auth/GoogleContinueButton'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

const googleAuthEnabled = isGoogleAuthEnabled()

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-slate-900 placeholder:text-slate-400 transition focus:border-brand-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-700/20'

function SignInForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams?.get('redirect') || ''

  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [formData, setFormData] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!googleAuthEnabled) return
    let cancelled = false
    ;(async () => {
      const result = await finishGoogleRedirect({
        registrationJourney: 'signin',
        pagePath: '/auth/signin',
      })
      if (cancelled || !result) return
      if (!result.ok) {
        if (result.needsAccountLink) {
          const q = result.email ? `?email=${encodeURIComponent(result.email)}` : ''
          router.push(`/auth/link-account${q}`)
          return
        }
        if (result.message && !/redirecting/i.test(result.message)) {
          toast.error(result.message)
        }
        return
      }
      toast.success('Signed in with Google')
      router.replace(redirectTo || result.redirectPath || '/sme/dashboard')
    })()
    return () => {
      cancelled = true
    }
  }, [router, redirectTo])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    if (!formData.email) newErrors.email = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Email is invalid'
    if (!formData.password) newErrors.password = 'Password is required'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    setLoading(true)
    try {
      const { user, userProfile } = await signIn(
        normalizeAuthEmail(formData.email),
        formData.password
      )
      const profile = userProfile || (await getUserProfile(user.uid))
      if (!profile?.userType) {
        toast.success('Almost there — choose SME or Youth Agent to finish setup')
        router.replace('/auth/role-selection?recover=1')
        return
      }
      const dest = resolvePostAuthDestination(profile)
      if (dest.blocked) {
        toast.error(dest.blockReason || 'Access denied.')
        return
      }
      toast.success('Signed in successfully')
      try {
        const { trackProductEvent } = await import('@/lib/founder/trackProductEvent')
        await trackProductEvent('user_logged_in', {
          feature: 'auth',
          pagePath: '/auth/signin',
          metadata: { authenticationProvider: 'password', deviceCategory: 'desktop' },
        })
      } catch {
        /* non-blocking */
      }
      if (redirectTo) router.push(redirectTo)
      else router.push(dest.path || homePathForProfile(profile))
    } catch (error: unknown) {
      toast.error(getAuthErrorMessage(error, 'Failed to sign in. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    setGoogleLoading(true)
    try {
      const result = await continueWithGoogle({
        registrationJourney: 'signin',
        pagePath: '/auth/signin',
      })
      if (!result.ok) {
        if (result.needsAccountLink) {
          const q = result.email ? `?email=${encodeURIComponent(result.email)}` : ''
          router.push(`/auth/link-account${q}`)
          return
        }
        if (result.message && !/redirecting/i.test(result.message)) {
          toast.error(result.message)
        }
        return
      }
      toast.success('Signed in with Google')
      router.replace(redirectTo || result.redirectPath || '/sme/dashboard')
    } catch (error: unknown) {
      toast.error(getAuthErrorMessage(error, 'Google sign-in failed.'))
    } finally {
      setGoogleLoading(false)
    }
  }

  return (
    <AuthShell
      title="Sign in to TenderBriefing"
      subtitle="Access your procurement dashboard, attendance requests, and briefing reports."
    >
      {googleAuthEnabled ? (
        <>
          <GoogleContinueButton onClick={handleGoogle} loading={googleLoading} disabled={loading} />
          <AuthMethodDivider />
        </>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-semibold text-slate-700">
            Email
          </label>
          <input
            type="email"
            id="email"
            name="email"
            autoComplete="email"
            value={formData.email}
            onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
            className={`mt-1 ${inputClass} ${errors.email ? 'border-red-400' : ''}`}
            placeholder="you@company.co.za"
          />
          {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
        </div>

        <div>
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="password" className="block text-sm font-semibold text-slate-700">
              Password
            </label>
            <Link
              href="/auth/forgot-password"
              className="text-sm font-semibold text-brand-800 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <input
            type="password"
            id="password"
            name="password"
            autoComplete="current-password"
            value={formData.password}
            onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))}
            className={`mt-1 ${inputClass} ${errors.password ? 'border-red-400' : ''}`}
            placeholder="Enter your password"
          />
          {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
        </div>

        <button
          type="submit"
          disabled={loading || googleLoading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-800 py-3.5 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? <LoadingSpinner size="sm" /> : 'Sign in to TenderBriefing'}
        </button>
      </form>

      <div className="mt-6 flex items-center gap-4">
        <span className="h-px flex-1 bg-slate-200" />
        <span className="text-xs font-medium uppercase tracking-wider text-slate-400">or</span>
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Link
          href="/auth/role-selection"
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-brand-200 bg-white px-4 py-3 text-sm font-semibold text-brand-900 transition hover:border-brand-400 hover:bg-brand-50"
        >
          Create account
        </Link>
        <Link
          href="/tenders"
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
        >
          Browse tenders
        </Link>
      </div>
    </AuthShell>
  )
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <LoadingSpinner size="lg" />
        </div>
      }
    >
      <SignInForm />
    </Suspense>
  )
}
