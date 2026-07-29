'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { completePasswordReset, verifyResetCode } from '@/lib/auth'
import { getAuthErrorMessage } from '@/lib/auth/errors'
import { toast } from 'react-hot-toast'
import AuthShell from '@/components/auth/AuthShell'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-slate-900 placeholder:text-slate-400 transition focus:border-brand-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-700/20'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const oobCode = searchParams?.get('oobCode') || ''
  const mode = searchParams?.get('mode') || ''

  const [checking, setChecking] = useState(true)
  const [accountEmail, setAccountEmail] = useState('')
  const [codeError, setCodeError] = useState('')
  const [loading, setLoading] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false

    async function validateCode() {
      if (!oobCode || (mode && mode !== 'resetPassword')) {
        setCodeError(
          'This password reset link is missing or invalid. Request a new link from the forgot password page.'
        )
        setChecking(false)
        return
      }
      try {
        const email = await verifyResetCode(oobCode)
        if (!cancelled) {
          setAccountEmail(email)
          setCodeError('')
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setCodeError(
            getAuthErrorMessage(err, 'This password reset link is invalid or has expired.')
          )
        }
      } finally {
        if (!cancelled) setChecking(false)
      }
    }

    void validateCode()
    return () => {
      cancelled = true
    }
  }, [oobCode, mode])

  const validateForm = () => {
    const next: Record<string, string> = {}
    if (!password) next.password = 'Password is required'
    else if (password.length < 6) next.password = 'Password must be at least 6 characters'
    if (!confirmPassword) next.confirmPassword = 'Confirm your password'
    else if (password !== confirmPassword) next.confirmPassword = 'Passwords do not match'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    setLoading(true)
    try {
      await completePasswordReset(oobCode, password)
      toast.success('Password updated. You can sign in now.')
      router.push('/auth/signin')
    } catch (err: unknown) {
      toast.error(getAuthErrorMessage(err, 'Failed to reset password. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <AuthShell title="Reset your password" subtitle="Verifying your secure reset link…">
        <div className="flex justify-center py-8">
          <LoadingSpinner size="lg" />
        </div>
      </AuthShell>
    )
  }

  if (codeError) {
    return (
      <AuthShell title="Reset link unavailable" subtitle={codeError}>
        <div className="space-y-3">
          <Link
            href="/auth/forgot-password"
            className="flex w-full items-center justify-center rounded-xl bg-brand-800 py-3.5 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-700"
          >
            Request a new reset email
          </Link>
          <Link
            href="/auth/signin"
            className="flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Back to sign in
          </Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Choose a new password"
      subtitle={
        accountEmail
          ? `Set a new password for ${accountEmail}.`
          : 'Set a new password for your TenderBriefing account.'
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="password" className="block text-sm font-semibold text-slate-700">
            New password
          </label>
          <input
            type="password"
            id="password"
            name="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`mt-1 ${inputClass} ${errors.password ? 'border-red-400' : ''}`}
            placeholder="At least 6 characters"
          />
          {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-semibold text-slate-700">
            Confirm password
          </label>
          <input
            type="password"
            id="confirmPassword"
            name="confirmPassword"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={`mt-1 ${inputClass} ${errors.confirmPassword ? 'border-red-400' : ''}`}
            placeholder="Re-enter your new password"
          />
          {errors.confirmPassword && (
            <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-800 py-3.5 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? <LoadingSpinner size="sm" /> : 'Update password'}
        </button>
      </form>
    </AuthShell>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <LoadingSpinner size="lg" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  )
}
