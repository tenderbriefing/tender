'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { signUp } from '@/lib/auth'
import { getAuthErrorMessage, normalizeAuthEmail } from '@/lib/auth/errors'
import { dashboardPathForRole } from '@/lib/auth/redirects'
import { SA_PROVINCES } from '@/lib/procurement/provinces'
import { toast } from 'react-hot-toast'
import AuthShell from '@/components/auth/AuthShell'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import SmeCategoryCommoditySelector from '@/components/sme/SmeCategoryCommoditySelector'
import { buildMatchingKeywords } from '@/lib/data/csdProcurementCatalog'

const inputClass =
  'w-full rounded-lg border border-slate-200 px-4 py-3 text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20'

export default function SignUpPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialType = searchParams?.get('type') === 'youth-agent' ? 'youth-agent' : 'sme'

  const [loading, setLoading] = useState(false)
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

  return (
    <AuthShell
      title={isSme ? 'SME Registration' : 'Youth Agent Registration'}
      subtitle={
        isSme
          ? 'Register your company to request briefing attendance support and Briefing Reports.'
          : 'Register to accept briefing assignments and submit reports for SMEs.'
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <Link
            href="/auth/signup?type=sme"
            className={`rounded-lg border py-2 text-center font-semibold ${
              isSme ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-slate-200'
            }`}
          >
            SME
          </Link>
          <Link
            href="/auth/signup?type=youth-agent"
            className={`rounded-lg border py-2 text-center font-semibold ${
              !isSme ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-slate-200'
            }`}
          >
            Youth Agent
          </Link>
        </div>

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
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? <LoadingSpinner size="sm" /> : 'Create account'}
        </button>
      </form>

      <p className="mt-4 text-center text-xs text-slate-500">
        Youth Agents are verified before assignments. Status defaults to pending.
      </p>

      <p className="mt-4 text-center text-sm text-slate-600">
        Already registered?{' '}
        <Link href="/auth/signin" className="font-semibold text-brand-700 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  )
}
