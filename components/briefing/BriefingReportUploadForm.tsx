'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { useAuth } from '@/components/providers/AuthProvider'
import { authFetch } from '@/lib/api/authenticatedFetch'
import { toast } from 'react-hot-toast'
import { CheckCircle } from 'lucide-react'

const fieldClass =
  'mt-1 w-full rounded-lg border border-slate-200 px-4 py-3 text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20'

export default function BriefingReportUploadForm() {
  const { user, userProfile, loading: authLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const requestId = searchParams.get('requestId') || ''
  const tenderId = searchParams.get('tenderId') || ''

  const [attendanceConfirmation, setAttendanceConfirmation] = useState('')
  const [briefingNotes, setBriefingNotes] = useState('')
  const [keyInstructions, setKeyInstructions] = useState('')
  const [submissionRequirements, setSubmissionRequirements] = useState('')
  const [risksNotes, setRisksNotes] = useState('')
  const [attendanceProofUrl, setAttendanceProofUrl] = useState('')
  const [audioUrl, setAudioUrl] = useState('')
  const [documentUrlsText, setDocumentUrlsText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!authLoading) {
      if (!user) router.push('/auth/signin')
      else if (userProfile?.userType !== 'youth-agent') router.push('/dashboard')
    }
  }, [authLoading, user, userProfile, router])

  const validate = () => {
    const e: Record<string, string> = {}
    if (!requestId) e.request = 'Missing attendance request ID'
    if (!attendanceConfirmation.trim()) e.attendance = 'Attendance confirmation is required'
    if (!briefingNotes.trim()) e.notes = 'Briefing notes are required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!validate() || !user) return

    const documentUrls = documentUrlsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)

    const summary = [
      '## Attendance Confirmation',
      attendanceConfirmation.trim(),
      '## Briefing Notes',
      briefingNotes.trim(),
      keyInstructions.trim() && `## Key Instructions from Briefing\n${keyInstructions.trim()}`,
    ]
      .filter(Boolean)
      .join('\n\n')

    const notes = [
      submissionRequirements.trim() &&
        `## Submission Requirements Mentioned\n${submissionRequirements.trim()}`,
      risksNotes.trim() && `## Risks / Important Notes\n${risksNotes.trim()}`,
    ]
      .filter(Boolean)
      .join('\n\n')

    setSubmitting(true)
    try {
      const res = await authFetch('/api/briefing-reports', {
        method: 'POST',
        body: JSON.stringify({
          requestId,
          tenderId,
          summary,
          notes: notes || undefined,
          attendanceProofUrl: attendanceProofUrl || undefined,
          audioUrl: audioUrl || undefined,
          documentUrls,
        }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      setSubmitted(true)
      toast.success('Briefing Report submitted successfully')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <main className="mx-auto max-w-lg px-4 py-16 text-center">
          <CheckCircle className="mx-auto h-14 w-14 text-brand-600" />
          <h1 className="mt-4 text-2xl font-bold text-slate-900">Briefing Report Submitted</h1>
          <p className="mt-2 text-slate-600">
            Your attendance notes and documents have been recorded. The SME can view the Briefing
            Report from My Attendance Requests.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/jobs"
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Back to Assignments
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <Link href="/jobs" className="text-sm font-semibold text-brand-700">
          ← Assigned Briefings
        </Link>
        <h1 className="mt-3 text-2xl font-bold text-slate-900">Submit Briefing Report</h1>
        <p className="mt-1 text-sm text-slate-600">
          Provide attendance confirmation, briefing notes, and supporting documents for the SME.
        </p>

        {!requestId && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            Open this form from an assigned briefing to include the correct request reference.
          </p>
        )}

        <form onSubmit={onSubmit} className="mt-8 space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-bold text-slate-900">Tender Details</h2>
            <p className="mt-1 text-sm text-slate-600">
              Request ID: <span className="font-mono">{requestId || '—'}</span>
            </p>
            {errors.request && (
              <p className="mt-2 text-sm text-red-600">{errors.request}</p>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <h2 className="font-bold text-slate-900">Attendance Confirmation</h2>
            <p className="text-xs text-slate-500">
              Confirm you attended the briefing session (register signed, name called, etc.).
            </p>
            <textarea
              className={fieldClass}
              rows={3}
              required
              value={attendanceConfirmation}
              onChange={(e) => setAttendanceConfirmation(e.target.value)}
              placeholder="I attended the compulsory briefing on [date] at [venue]…"
            />
            {errors.attendance && (
              <p className="text-sm text-red-600">{errors.attendance}</p>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <h2 className="font-bold text-slate-900">Briefing Notes</h2>
            <textarea
              className={fieldClass}
              rows={5}
              required
              value={briefingNotes}
              onChange={(e) => setBriefingNotes(e.target.value)}
              placeholder="Summary of what was discussed at the briefing session…"
            />
            {errors.notes && <p className="text-sm text-red-600">{errors.notes}</p>}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <h2 className="font-bold text-slate-900">Key Instructions from Briefing</h2>
            <textarea
              className={fieldClass}
              rows={3}
              value={keyInstructions}
              onChange={(e) => setKeyInstructions(e.target.value)}
            />
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <h2 className="font-bold text-slate-900">Documents / Photos</h2>
            <p className="text-xs text-slate-500">
              Paste public URLs for photos of the register, venue, slides, or handouts (one per
              line). Upload files to your storage first if needed.
            </p>
            <label className="block text-sm font-medium text-slate-700">Attendance Proof URL</label>
            <input
              className={fieldClass}
              value={attendanceProofUrl}
              onChange={(e) => setAttendanceProofUrl(e.target.value)}
              placeholder="Photo of sign-in register or attendance sheet"
            />
            <label className="block text-sm font-medium text-slate-700">Audio recording URL</label>
            <input
              className={fieldClass}
              value={audioUrl}
              onChange={(e) => setAudioUrl(e.target.value)}
            />
            <label className="block text-sm font-medium text-slate-700">
              Additional document URLs
            </label>
            <textarea
              className={`${fieldClass} font-mono text-xs`}
              rows={4}
              value={documentUrlsText}
              onChange={(e) => setDocumentUrlsText(e.target.value)}
            />
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <h2 className="font-bold text-slate-900">Submission Requirements Mentioned</h2>
            <textarea
              className={fieldClass}
              rows={3}
              value={submissionRequirements}
              onChange={(e) => setSubmissionRequirements(e.target.value)}
            />
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <h2 className="font-bold text-slate-900">Risks / Important Notes</h2>
            <textarea
              className={fieldClass}
              rows={3}
              value={risksNotes}
              onChange={(e) => setRisksNotes(e.target.value)}
            />
          </section>

          <button
            type="submit"
            disabled={submitting || !requestId}
            className="flex w-full min-h-[48px] items-center justify-center rounded-lg bg-brand-600 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {submitting ? 'Submitting Briefing Report…' : 'Submit Briefing Report'}
          </button>
        </form>
      </main>
      <Footer />
    </div>
  )
}
