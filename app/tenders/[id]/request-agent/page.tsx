'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { useAuth } from '@/components/providers/AuthProvider'
import { authFetch } from '@/lib/api/authenticatedFetch'
import { formatProcurementDateTime } from '@/lib/procurement/dates'
import { toast } from 'react-hot-toast'
import type { TenderBriefing } from '@/lib/tenderBriefing/types'

export default function RequestYouthAgentPage() {
  const { id } = useParams<{ id: string }>()
  const { user, userProfile, loading: authLoading } = useAuth()
  const router = useRouter()
  const [tender, setTender] = useState<TenderBriefing | null>(null)
  const [notes, setNotes] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push(`/auth/signin?redirect=/tenders/${id}/request-agent`)
      } else if (userProfile?.userType !== 'sme') {
        router.push('/dashboard')
      }
    }
  }, [authLoading, user, userProfile, router, id])

  useEffect(() => {
    if (!id) return
    fetch(`/api/tender-briefings/${id}`)
      .then((r) => r.json())
      .then((j) => j.success && setTender(j.data))
  }, [id])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!user || !tender) return
    if (!acknowledged) {
      toast.error('Please confirm your submission responsibility')
      return
    }

    setSubmitting(true)
    try {
      const res = await authFetch('/api/attendance-requests', {
        method: 'POST',
        body: JSON.stringify({
          tenderId: tender.id,
          notes,
          responsibilityAcknowledged: true,
        }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      const requestId = json.data?.request?.id
      toast.success('Attendance request submitted')
      router.push(
        requestId
          ? `/sme/requests/confirmation?requestId=${requestId}&tenderId=${tender.id}`
          : '/sme/requests/confirmation'
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (authLoading || !tender) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <Link href={`/tenders/${tender.id}`} className="text-sm font-semibold text-brand-700">
          ← Back to tender
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-slate-900">Request Youth Agent Attendance</h1>

        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-bold text-slate-900">Tender summary</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Tender number</dt>
              <dd className="font-mono font-semibold text-slate-900">{tender.tenderNumber}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Title</dt>
              <dd className="mt-0.5 font-medium text-slate-900">{tender.title}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Department</dt>
              <dd className="text-slate-900">{tender.department}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Province</dt>
              <dd className="text-slate-900">{tender.province}</dd>
            </div>
          </dl>
        </section>

        <section className="mt-4 rounded-xl border-2 border-amber-200 bg-amber-50/60 p-5">
          <h2 className="font-bold text-slate-900">Compulsory briefing</h2>
          <p className="mt-2 text-sm text-slate-700">
            <span className="font-semibold">Date & time:</span>{' '}
            {formatProcurementDateTime(tender.briefingDate, tender.briefingTime) || 'TBC'}
          </p>
          <p className="mt-1 text-sm text-slate-700">
            <span className="font-semibold">Venue:</span> {tender.briefingVenue || 'TBC'}
          </p>
        </section>

        <section className="mt-4 rounded-xl border border-slate-200 bg-white p-5 text-sm">
          <h2 className="font-bold text-slate-900">Your contact details</h2>
          <p className="mt-2 text-slate-700">{userProfile?.displayName || user?.displayName}</p>
          <p className="text-slate-700">{userProfile?.companyName || 'Company name on profile'}</p>
          <p className="text-slate-700">{user?.email}</p>
          {(userProfile as { phone?: string } | null)?.phone && (
            <p className="text-slate-700">{(userProfile as { phone?: string }).phone}</p>
          )}
        </section>

        <form onSubmit={onSubmit} className="mt-6 bg-white rounded-2xl border p-6 space-y-4 shadow-sm">
          <div className="rounded-lg border border-brand-100 bg-brand-50 p-4 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">Attendance support fee</p>
            <p className="mt-1">
              Attendance support fee will be confirmed before payment. Payment is not required to
              submit this request.
            </p>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Notes for agent</span>
            <textarea
              className="mt-1 w-full border border-slate-200 rounded-lg p-3 text-sm"
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Register name, access instructions, PPE requirements, etc."
            />
          </label>

          <label className="flex items-start gap-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600"
            />
            <span>
              I understand final tender submission remains my responsibility. TenderBriefing
              provides briefing attendance support and intelligence only.
            </span>
          </label>

          <button
            type="submit"
            disabled={submitting || !acknowledged}
            className="w-full py-3 rounded-xl bg-brand-600 text-white font-semibold hover:bg-brand-700 disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : 'Submit attendance request'}
          </button>
        </form>
      </main>
      <Footer />
    </div>
  )
}
