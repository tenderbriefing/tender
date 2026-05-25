'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { useAuth } from '@/components/providers/AuthProvider'
import { SA_PROVINCES } from '@/lib/procurement/provinces'
import { saveAgentOnboarding } from '@/lib/onboarding/client'
import { toast } from 'react-hot-toast'

const inputClass =
  'w-full rounded-lg border border-slate-200 px-4 py-3 text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20'

export default function AgentOnboardingPage() {
  const { user, userProfile, loading } = useAuth()
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    displayName: '',
    province: '',
    city: '',
    whatsAppNumber: '',
    transportAvailable: true,
    preferredAreas: '',
    idVerificationNote: '',
    codeOfConductAccepted: false,
  })

  useEffect(() => {
    if (!loading && !user) router.push('/auth/signin?redirect=/agent/onboarding')
    if (!loading && userProfile && userProfile.userType !== 'youth-agent') {
      router.push('/dashboard')
    }
    if (userProfile) {
      setForm((p) => ({
        ...p,
        displayName: userProfile.displayName || p.displayName,
        province: userProfile.province || p.province,
        city: userProfile.city || p.city,
        whatsAppNumber: userProfile.whatsAppNumber || userProfile.phoneNumber || p.whatsAppNumber,
        transportAvailable: userProfile.transportAvailable !== false,
        preferredAreas: (userProfile.preferredServiceAreas || []).join(', '),
        idVerificationNote: userProfile.idVerificationNote || p.idVerificationNote,
        codeOfConductAccepted: userProfile.codeOfConductAccepted === true,
      }))
      if (userProfile.onboardingCompleted) {
        router.replace('/agent/dashboard')
      }
    }
  }, [user, userProfile, loading, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !userProfile) return
    if (!form.displayName.trim() || !form.province || !form.city.trim()) {
      toast.error('Name, province, and city are required')
      return
    }
    if (!form.whatsAppNumber.trim()) {
      toast.error('WhatsApp number is required')
      return
    }
    if (!form.codeOfConductAccepted) {
      toast.error('You must accept the code of conduct')
      return
    }

    setSubmitting(true)
    try {
      const areas = form.preferredAreas
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean)

      await saveAgentOnboarding(user.uid, user.email || userProfile.email, userProfile, {
        displayName: form.displayName,
        province: form.province,
        city: form.city,
        whatsAppNumber: form.whatsAppNumber,
        transportAvailable: form.transportAvailable,
        preferredServiceAreas: areas.length ? areas : [form.province],
        idVerificationNote: form.idVerificationNote,
        codeOfConductAccepted: form.codeOfConductAccepted,
      })
      toast.success('Agent profile saved')
      router.push('/agent/dashboard')
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
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-700">
            Youth Agent onboarding
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Join the briefing network</h1>
          <p className="mt-2 text-slate-600">
            Complete your profile to receive dispatch opportunities and build your reliability
            score.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
        >
          <div>
            <label className="block text-sm font-semibold text-slate-700">Full name *</label>
            <input
              value={form.displayName}
              onChange={(e) => setForm((p) => ({ ...p, displayName: e.target.value }))}
              className={`mt-1 ${inputClass}`}
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold text-slate-700">Province *</label>
              <select
                value={form.province}
                onChange={(e) => setForm((p) => ({ ...p, province: e.target.value }))}
                className={`mt-1 ${inputClass}`}
                required
              >
                <option value="">Select</option>
                {SA_PROVINCES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700">City / town *</label>
              <input
                value={form.city}
                onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
                className={`mt-1 ${inputClass}`}
                required
              />
            </div>
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
          <label className="flex items-center gap-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.transportAvailable}
              onChange={(e) =>
                setForm((p) => ({ ...p, transportAvailable: e.target.checked }))
              }
              className="h-4 w-4 rounded border-slate-300 text-brand-600"
            />
            I have reliable transport to attend briefings
          </label>
          <div>
            <label className="block text-sm font-semibold text-slate-700">Preferred areas</label>
            <input
              value={form.preferredAreas}
              onChange={(e) => setForm((p) => ({ ...p, preferredAreas: e.target.value }))}
              placeholder="Cities or regions (comma-separated)"
              className={`mt-1 ${inputClass}`}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700">
              ID verification (placeholder)
            </label>
            <input
              value={form.idVerificationNote}
              onChange={(e) => setForm((p) => ({ ...p, idVerificationNote: e.target.value }))}
              placeholder="ID number or reference — full verification during pilot review"
              className={`mt-1 ${inputClass}`}
            />
            <p className="mt-1 text-xs text-slate-500">
              Admin will verify identity before elevating your agent tier. Do not upload documents
              here during pilot.
            </p>
          </div>
          <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.codeOfConductAccepted}
              onChange={(e) =>
                setForm((p) => ({ ...p, codeOfConductAccepted: e.target.checked }))
              }
              className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600"
              required
            />
            <span>
              I accept the Youth Agent code of conduct: attend assigned briefings professionally,
              submit accurate reports on time, protect SME confidentiality, and follow venue rules.{' '}
              <Link href="/terms" className="font-semibold text-brand-700 hover:underline">
                Terms
              </Link>
            </span>
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-brand-600 py-3 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {submitting ? 'Saving…' : 'Complete onboarding'}
          </button>
        </form>
      </main>
      <Footer />
    </div>
  )
}
