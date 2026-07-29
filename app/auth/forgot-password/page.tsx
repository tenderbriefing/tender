'use client'

import { useState } from 'react'
import Link from 'next/link'
import { requestPasswordReset } from '@/lib/auth'
import { getAuthErrorMessage, normalizeAuthEmail } from '@/lib/auth/errors'
import { toast } from 'react-hot-toast'
import AuthShell from '@/components/auth/AuthShell'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-slate-900 placeholder:text-slate-400 transition focus:border-brand-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-700/20'

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const validate = () => {
    if (!email.trim()) {
      setError('Email is required')
      return false
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Email is invalid')
      return false
    }
    setError('')
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    try {
      await requestPasswordReset(normalizeAuthEmail(email))
      setSent(true)
      toast.success('Password reset email sent')
    } catch (err: unknown) {
      toast.error(getAuthErrorMessage(err, 'Failed to send reset email. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter the email for your TenderBriefing account and we will send a secure reset link."
    >
      {sent ? (
        <div className="space-y-5">
          <div className="rounded-xl border border-brand-100 bg-brand-50/60 px-4 py-4 text-sm leading-relaxed text-slate-700">
            If an account exists for <span className="font-semibold text-brand-900">{normalizeAuthEmail(email)}</span>,
            you will receive a password reset email shortly. Check your inbox and spam folder, then
            follow the link to choose a new password.
          </div>
          <Link
            href="/auth/signin"
            className="flex w-full items-center justify-center rounded-xl bg-brand-800 py-3.5 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-700"
          >
            Back to sign in
          </Link>
          <button
            type="button"
            onClick={() => setSent(false)}
            className="w-full text-center text-sm font-semibold text-brand-800 hover:underline"
          >
            Use a different email
          </button>
        </div>
      ) : (
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
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`mt-1 ${inputClass} ${error ? 'border-red-400' : ''}`}
              placeholder="you@company.co.za"
            />
            {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-800 py-3.5 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-700 disabled:opacity-50"
          >
            {loading ? <LoadingSpinner size="sm" /> : 'Send reset email'}
          </button>

          <p className="text-center text-sm text-slate-600">
            Remembered your password?{' '}
            <Link href="/auth/signin" className="font-semibold text-brand-800 hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  )
}
