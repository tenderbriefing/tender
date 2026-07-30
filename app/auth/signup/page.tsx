'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { signUp } from '@/lib/auth'
import { getAuthErrorMessage, normalizeAuthEmail } from '@/lib/auth/errors'
import { dashboardPathForRole } from '@/lib/auth/redirects'
import { continueWithGoogle, finishGoogleRedirect } from '@/lib/auth/continueWithGoogle'
import { requestWelcomeEmail } from '@/lib/auth/requestWelcomeEmail'
import { SA_PROVINCES } from '@/lib/procurement/provinces'
import { toast } from 'react-hot-toast'
import AuthShell from '@/components/auth/AuthShell'
import GoogleContinueButton, {
  AuthMethodDivider,
} from '@/components/auth/GoogleContinueButton'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import SmeCategoryCommoditySelector from '@/components/sme/SmeCategoryCommoditySelector'
import { buildMatchingKeywords } from '@/lib/data/csdProcurementCatalog'

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-slate-900 placeholder:text-slate-400 transition focus:border-brand-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-700/20'

function SignUpForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialType = searchParams?.get('type') === 'youth-agent' ? 'youth-agent' : 'sme'

  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    displayName: '',
    userType: initialType as 'sme' | 'youth-agent',
    companyName: '',
    phoneNumber: '',
    province: '',
    city: '',
    csdNumber: '',
    categories: [] as string[],
    commodities: [] as string[],
    availabilityRadiusKm: 25,
    transportAvailable: true,
    preferredServiceAreas: [] as string[],
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    setFormData((p) => ({ ...p, userType: initialType as 'sme' | 'youth-agent' }))
  }, [initialType])

  useEffect(() => {
    let cancelled = false
    const journey = initialType === 'youth-agent' ? 'youth-agent' : 'sme'
    ;(async () => {
      const result = await finishGoogleRedirect({
        registrationJourney: journey,
        intendedRole: journey,
        pagePath: `/auth/signup?type=${journey}`,
      })
      if (cancelled || !result) return
      if (!result.ok) {
        if (result.needsAccountLink) {
          const q = result.email ? `?email=${encodeURIComponent(result.email)}` : ''
          router.push(`/auth/link-account${q}`)
          return
        }
        if (result.message && !/redirecting/i.test(result.message)) toast.error(result.message)
        return
      }
      toast.success('Continue onboarding to finish your profile')
      router.replace(result.redirectPath || (journey === 'sme' ? '/sme/onboarding' : '/agent/onboarding'))
    })()
    return () => {
      cancelled = true
    }
  }, [initialType, router])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    if (!formData.email) newErrors.email = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Email is invalid'
    if (!formData.password || formData.password.length < 6)
      newErrors.password = 'Password must be at least 6 characters'
    if (formData.password !== formData.confirmPassword)
      newErrors.confirmPassword = 'Passwords do not match'
    if (!formData.displayName) newErrors.displayName = 'Full name is required'
    if (formData.userType === 'sme' && !formData.companyName)
      newErrors.companyName = 'Company name is required'
    if (formData.userType === 'sme' && formData.categories.length === 0)
      newErrors.categories = 'Select at least one business category'
    if (!formData.phoneNumber) newErrors.phoneNumber = 'Phone is required'
    if (!formData.province) newErrors.province = 'Province is required'
    if (formData.userType === 'youth-agent' && !formData.city)
      newErrors.city = 'City/town is required'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    setLoading(true)
    try {
      const isSme = formData.userType === 'sme'
      const additionalData = isSme
        ? {
            companyName: formData.companyName,
            contactPerson: formData.displayName,
            phoneNumber: formData.phoneNumber,
            province: formData.province,
            location: `${formData.city || ''} ${formData.province}`.trim(),
            categories: formData.categories,
            commodities: formData.commodities,
            matchingKeywords: buildMatchingKeywords(
              formData.categories,
              formData.commodities
            ),
            sectors: formData.categories,
            provincesOfInterest: [formData.province],
            ...(formData.csdNumber ? { csdNumber: formData.csdNumber.trim() } : {}),
            onboardingCompleted: true,
          }
        : {
            phoneNumber: formData.phoneNumber,
            province: formData.province,
            city: formData.city,
            location: `${formData.city}, ${formData.province}`,
            availabilityRadiusKm: formData.availabilityRadiusKm,
            transportAvailable: formData.transportAvailable,
            preferredServiceAreas: formData.preferredServiceAreas.length
              ? formData.preferredServiceAreas
              : [formData.province],
            verificationStatus: 'pending' as const,
            reliabilityScore: 100,
            missedBriefingCount: 0,
            completedBriefingCount: 0,
            acceptedBriefingCount: 0,
            onboardingCompleted: true,
          }

      const { userProfile } = await signUp(
        normalizeAuthEmail(formData.email),
        formData.password,
        formData.displayName.trim(),
        formData.userType,
        additionalData
      )

      // Non-blocking — registration succeeds even if mail fails / Resend is unset.
      void requestWelcomeEmail()

      const destination = dashboardPathForRole(userProfile?.userType || formData.userType)
      toast.success("You're signed in — welcome to TenderBriefing")
      router.replace(destination)
    } catch (error: unknown) {
      toast.error(getAuthErrorMessage(error, 'Registration failed. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  const isSme = formData.userType === 'sme'

  const handleGoogle = async () => {
    const journey = isSme ? 'sme' : 'youth-agent'
    setGoogleLoading(true)
    try {
      const result = await continueWithGoogle({
        registrationJourney: journey,
        intendedRole: journey,
        pagePath: `/auth/signup?type=${journey}`,
      })
      if (!result.ok) {
        if (result.needsAccountLink) {
          const q = result.email ? `?email=${encodeURIComponent(result.email)}` : ''
          router.push(`/auth/link-account${q}`)
          return
        }
        if (result.message && !/redirecting/i.test(result.message)) toast.error(result.message)
        return
      }
      // Existing users keep their role; first-time users go to onboarding for this journey.
      toast.success(
        result.profile?.onboardingCompleted
          ? 'Signed in with Google'
          : 'Continue onboarding to finish your profile'
      )
      router.replace(result.redirectPath || (isSme ? '/sme/onboarding' : '/agent/onboarding'))
    } catch (error: unknown) {
      toast.error(getAuthErrorMessage(error, 'Google registration failed.'))
    } finally {
      setGoogleLoading(false)
    }
  }

  return (
    <AuthShell
      title={isSme ? 'SME Registration' : 'Youth Agent Registration'}
      subtitle={
        isSme
          ? 'Register your company to request briefing attendance support and Briefing Reports.'
          : 'Register to accept briefing assignments and submit reports for SMEs.'
      }
    >
      <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 text-sm">
        <Link
          href="/auth/signup?type=sme"
          className={`rounded-lg py-2 text-center font-semibold transition ${
            isSme ? 'bg-white text-brand-900 shadow-sm' : 'text-slate-600 hover:text-brand-800'
          }`}
        >
          SME
        </Link>
        <Link
          href="/auth/signup?type=youth-agent"
          className={`rounded-lg py-2 text-center font-semibold transition ${
            !isSme ? 'bg-white text-brand-900 shadow-sm' : 'text-slate-600 hover:text-brand-800'
          }`}
        >
          Youth Agent
        </Link>
      </div>

      <GoogleContinueButton
        onClick={handleGoogle}
        loading={googleLoading}
        disabled={loading}
        label={isSme ? 'Continue with Google as SME' : 'Continue with Google as Youth Agent'}
      />
      <AuthMethodDivider label="or register with email" />

      <form onSubmit={handleSubmit} className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">

        {isSme && (
          <div>
            <label className="block text-sm font-semibold text-slate-700">Company name</label>
            <input
              name="companyName"
              autoComplete="organization"
              value={formData.companyName}
              onChange={(e) => setFormData((p) => ({ ...p, companyName: e.target.value }))}
              className={`mt-1 ${inputClass}`}
            />
            {errors.companyName && (
              <p className="mt-1 text-sm text-red-600">{errors.companyName}</p>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-slate-700">
            {isSme ? 'Contact person' : 'Full name'}
          </label>
          <input
            name="displayName"
            autoComplete="name"
            value={formData.displayName}
            onChange={(e) => setFormData((p) => ({ ...p, displayName: e.target.value }))}
            className={`mt-1 ${inputClass}`}
          />
          {errors.displayName && (
            <p className="mt-1 text-sm text-red-600">{errors.displayName}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700">Email</label>
          <input
            type="email"
            name="email"
            autoComplete="email"
            value={formData.email}
            onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
            className={`mt-1 ${inputClass}`}
          />
          {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700">Phone</label>
          <input
            type="tel"
            name="phoneNumber"
            autoComplete="tel"
            value={formData.phoneNumber}
            onChange={(e) => setFormData((p) => ({ ...p, phoneNumber: e.target.value }))}
            className={`mt-1 ${inputClass}`}
          />
          {errors.phoneNumber && (
            <p className="mt-1 text-sm text-red-600">{errors.phoneNumber}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700">Province</label>
          <select
            value={formData.province}
            onChange={(e) => setFormData((p) => ({ ...p, province: e.target.value }))}
            className={`mt-1 ${inputClass}`}
          >
            <option value="">Select province</option>
            {SA_PROVINCES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          {errors.province && <p className="mt-1 text-sm text-red-600">{errors.province}</p>}
        </div>

        {!isSme && (
          <>
            <div>
              <label className="block text-sm font-semibold text-slate-700">City / town</label>
              <input
                name="city"
                autoComplete="address-level2"
                value={formData.city}
                onChange={(e) => setFormData((p) => ({ ...p, city: e.target.value }))}
                className={`mt-1 ${inputClass}`}
              />
              {errors.city && <p className="mt-1 text-sm text-red-600">{errors.city}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700">
                Availability radius (km)
              </label>
              <input
                type="number"
                min={5}
                max={200}
                value={formData.availabilityRadiusKm}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    availabilityRadiusKm: Number(e.target.value),
                  }))
                }
                className={`mt-1 ${inputClass}`}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={formData.transportAvailable}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, transportAvailable: e.target.checked }))
                }
                className="rounded border-slate-300 text-brand-600"
              />
              I have transport available for briefing attendance
            </label>
          </>
        )}

        {isSme && (
          <>
            <div>
              <label className="block text-sm font-semibold text-slate-700">
                CSD number (optional)
              </label>
              <input
                value={formData.csdNumber}
                onChange={(e) => setFormData((p) => ({ ...p, csdNumber: e.target.value }))}
                className={`mt-1 ${inputClass}`}
                placeholder="Central Supplier Database number"
              />
            </div>
            <div className="sm:col-span-2">
              <SmeCategoryCommoditySelector
                value={{
                  categories: formData.categories,
                  commodities: formData.commodities,
                }}
                onChange={({ categories, commodities }) =>
                  setFormData((p) => ({ ...p, categories, commodities }))
                }
              />
              {errors.categories && (
                <p className="mt-2 text-sm text-red-600">{errors.categories}</p>
              )}
            </div>
          </>
        )}

        <div>
          <label className="block text-sm font-semibold text-slate-700">Password</label>
          <input
            type="password"
            name="password"
            autoComplete="new-password"
            value={formData.password}
            onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))}
            className={`mt-1 ${inputClass}`}
          />
          {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700">Confirm password</label>
          <input
            type="password"
            name="confirmPassword"
            autoComplete="new-password"
            value={formData.confirmPassword}
            onChange={(e) => setFormData((p) => ({ ...p, confirmPassword: e.target.value }))}
            className={`mt-1 ${inputClass}`}
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
          {loading ? <LoadingSpinner size="sm" /> : `Create ${isSme ? 'SME' : 'agent'} account`}
        </button>
      </form>

      {!isSme && (
        <p className="mt-4 text-center text-xs text-slate-500">
          Youth Agents are verified before receiving assignments — status defaults to pending.
        </p>
      )}

      <p className="mt-4 text-center text-sm text-slate-600">
        Already registered?{' '}
        <Link href="/auth/signin" className="font-semibold text-brand-800 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  )
}

export default function SignUpPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <LoadingSpinner size="lg" />
        </div>
      }
    >
      <SignUpForm />
    </Suspense>
  )
}
