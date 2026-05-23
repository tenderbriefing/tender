'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { signIn, getUserProfile } from '@/lib/auth'
import { dashboardPathForRole } from '@/lib/auth/redirects'
import { toast } from 'react-hot-toast'
import AuthShell from '@/components/auth/AuthShell'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

const inputClass =
  'w-full rounded-lg border border-slate-200 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20'

export default function SignInPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams?.get('redirect') || ''

  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})

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
      const { user } = await signIn(formData.email, formData.password)
      const profile = await getUserProfile(user.uid)
      toast.success('Signed in successfully')
      if (redirectTo) router.push(redirectTo)
      else router.push(dashboardPathForRole(profile?.userType))
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to sign in'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title="Sign in to TenderBriefing"
      subtitle="Access your procurement dashboard, attendance requests, and briefing reports."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-semibold text-slate-700">
            Email
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
            className={`mt-1 ${inputClass} ${errors.email ? 'border-red-400' : ''}`}
            placeholder="you@company.co.za"
          />
          {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-semibold text-slate-700">
            Password
          </label>
          <input
            type="password"
            id="password"
            name="password"
            value={formData.password}
            onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))}
            className={`mt-1 ${inputClass} ${errors.password ? 'border-red-400' : ''}`}
            placeholder="Enter your password"
          />
          {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? <LoadingSpinner size="sm" /> : 'Sign In'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        No account?{' '}
        <Link href="/auth/role-selection" className="font-semibold text-brand-700 hover:underline">
          Register
        </Link>
        {' · '}
        <Link href="/tenders" className="font-semibold text-slate-700 hover:underline">
          Browse tenders (public)
        </Link>
      </p>
    </AuthShell>
  )
}
