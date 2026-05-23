'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { useAuth } from '@/components/providers/AuthProvider'
import { authFetch } from '@/lib/api/authenticatedFetch'
import { toast } from 'react-hot-toast'
import type { TenderBriefing } from '@/lib/tenderBriefing/types'

export default function RequestYouthAgentPage() {
  const { id } = useParams<{ id: string }>()
  const { user, userProfile, loading: authLoading } = useAuth()
  const router = useRouter()
  const [tender, setTender] = useState<TenderBriefing | null>(null)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!authLoading) {
      if (!user) router.push('/auth/signin')
      else if (userProfile?.userType !== 'sme') router.push('/dashboard')
    }
  }, [authLoading, user, userProfile, router])

  useEffect(() => {
    if (!id) return
    fetch(`/api/tender-briefings/${id}`)
      .then((r) => r.json())
      .then((j) => j.success && setTender(j.data))
  }, [id])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!user || !tender) return

    setSubmitting(true)
    try {
      const res = await authFetch('/api/attendance-requests', {
        method: 'POST',
        body: JSON.stringify({
          tenderId: tender.id,
          notes,
        }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      const requestId = json.data?.request?.id
      toast.success('Attendance request submitted')
      router.push(
        requestId
          ? `/sme/requests/confirmation?requestId=${requestId}`
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
      <main className="max-w-lg mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-slate-900">Request Youth Agent</h1>
        <p className="text-slate-600 mt-2">{tender.title}</p>

        <form onSubmit={onSubmit} className="mt-8 bg-white rounded-2xl border p-6 space-y-4 shadow-sm">
          <div className="text-sm text-slate-600 space-y-1">
            <p>
              Briefing: {tender.briefingDate} {tender.briefingTime}
            </p>
            <p>Venue: {tender.briefingVenue || 'TBC'}</p>
            <p className="text-brand-700 font-medium">
              Status will start as pending until a Youth Agent accepts.
            </p>
          </div>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Notes for agent</span>
            <textarea
              className="mt-1 w-full border border-slate-200 rounded-lg p-3 text-sm"
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Special instructions, company name for register, etc."
            />
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-xl bg-brand-600 text-white font-semibold hover:bg-brand-700 disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : 'Request Youth Agent'}
          </button>
        </form>
      </main>
      <Footer />
    </div>
  )
}
