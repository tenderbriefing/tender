'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import SmeCategoryCommoditySelector from '@/components/sme/SmeCategoryCommoditySelector'
import { useAuth } from '@/components/providers/AuthProvider'
import { SA_PROVINCES } from '@/lib/procurement/provinces'
import { saveSmeOnboarding } from '@/lib/onboarding/client'
import { toast } from 'react-hot-toast'

const inputClass =
  'w-full rounded-lg border border-slate-200 px-4 py-3 text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20'

export default function SmeOnboardingPage() {
  const { user, userProfile, loading } = useAuth()
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    companyName: '',
    csdNumber: '',
    province: '',
    categories: [] as string[],
    commodities: [] as string[],
    preferredDepartments: '',
    whatsAppNumber: '',
    tenderInterests: '',
  })

  useEffect(() => {
    if (!loading && !user) router.push('/auth/signin?redirect=/sme/onboarding')
    if (!loading && userProfile && userProfile.userType !== 'sme') {
      router.push('/dashboard')
    }
    if (userProfile) {
      setForm((p) => ({
        ...p,
        companyName: userProfile.companyName || p.companyName,
        csdNumber: userProfile.csdNumber || p.csdNumber,
        province: userProfile.province || p.province,
        categories: userProfile.categories || p.categories,
        commodities: userProfile.commodities || p.commodities,
        preferredDepartments: (userProfile.preferredDepartments || []).join(', '),
        whatsAppNumber: userProfile.whatsAppNumber || userProfile.phoneNumber || p.whatsAppNumber,
        tenderInterests: userProfile.tenderInterests || p.tenderInterests,
      }))
      if (userProfile.onboardingCompleted) {
        router.replace('/sme/dashboard')
      }
    }
  }, [user, userProfile, loading, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !userProfile) return
    if (!form.companyName.trim()) {
      toast.error('Company name is required')
      return
    }
    if (!form.province) {
      toast.error('Province is required')
      return
    }
    if (form.categories.length === 0) {
      toast.error('Select at least one business category')
      return
    }
    if (!form.whatsAppNumber.trim()) {
      toast.error('WhatsApp number is required')
      return
    }

    setSubmitting(true)
    try {
      const departments = form.preferredDepartments
        .split(',')
        .map((d) => d.trim())
        .filter(Boolean)

      await saveSmeOnboarding(user.uid, user.email || userProfile.email, userProfile, {
        companyName: form.companyName,
        csdNumber: form.csdNumber,
        province: form.province,
        categories: form.categories,
        commodities: form.commodities,
        preferredDepartments: departments,
        whatsAppNumber: form.whatsAppNumber,
        tenderInterests: form.tenderInterests,
      })
      toast.success('SME profile saved')
      router.push('/sme/dashboard')
    } catch {
      toast.error('Could not save profile. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-brand-50/30">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:py-12">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-700">
            SME onboarding
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Tell us about your business</h1>
          <p className="mt-2 max-w-2xl text-slate-600">
            Help us match you with relevant government tenders and compulsory briefing sessions —
            at no cost to browse or receive matches.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-slate-700">Company name *</label>
              <input
                value={form.companyName}
                onChange={(e) => setForm((p) => ({ ...p, companyName: e.target.value }))}
                className={`mt-1 ${inputClass}`}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700">CSD number</label>
              <input
                value={form.csdNumber}
                onChange={(e) => setForm((p) => ({ ...p, csdNumber: e.target.value }))}
                placeholder="Central Supplier Database registration"
                className={`mt-1 ${inputClass}`}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700">Province *</label>
              <select
                value={form.province}
                onChange={(e) => setForm((p) => ({ ...p, province: e.target.value }))}
                className={`mt-1 ${inputClass}`}
                required
              >
                <option value="">Select province</option>
                {SA_PROVINCES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <SmeCategoryCommoditySelector
            value={{ categories: form.categories, commodities: form.commodities }}
            onChange={({ categories, commodities }) =>
              setForm((p) => ({ ...p, categories, commodities }))
            }
          />

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-slate-700">
                Preferred departments
              </label>
              <input
                value={form.preferredDepartments}
                onChange={(e) => setForm((p) => ({ ...p, preferredDepartments: e.target.value }))}
                placeholder="e.g. Health, Education, Public Works (comma-separated)"
                className={`mt-1 ${inputClass}`}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700">WhatsApp number *</label>
              <input
                type="tel"
                value={form.whatsAppNumber}
                onChange={(e) => setForm((p) => ({ ...p, whatsAppNumber: e.target.value }))}
                placeholder="+27..."
                className={`mt-1 ${inputClass}`}
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-slate-700">Tender interests</label>
              <textarea
                value={form.tenderInterests}
                onChange={(e) => setForm((p) => ({ ...p, tenderInterests: e.target.value }))}
                rows={3}
                placeholder="Optional — describe the types of tenders and briefing support you need most"
                className={`mt-1 ${inputClass}`}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-brand-600 py-3.5 font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-60"
          >
            {submitting ? 'Saving…' : 'Complete onboarding'}
          </button>
          <p className="text-center text-sm text-slate-500">
            Already done?{' '}
            <Link href="/sme/dashboard" className="font-semibold text-brand-700">
              Go to dashboard
            </Link>
          </p>
        </form>
      </main>
      <Footer />
    </div>
  )
}
