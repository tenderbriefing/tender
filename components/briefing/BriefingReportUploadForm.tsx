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
import { CheckCircle, Upload } from 'lucide-react'

const fieldClass =
  'mt-1 w-full rounded-lg border border-slate-200 px-4 py-3 text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20'

const MAX_FILE_BYTES = 10 * 1024 * 1024

export default function BriefingReportUploadForm() {
  const { user, userProfile, loading: authLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const requestId = searchParams.get('requestId') || ''
  const tenderId = searchParams.get('tenderId') || ''

  const [attendanceConfirmed, setAttendanceConfirmed] = useState<'yes' | 'no' | ''>('')
  const [arrivalTime, setArrivalTime] = useState('')
  const [briefingStartedTime, setBriefingStartedTime] = useState('')
  const [briefingNotes, setBriefingNotes] = useState('')
  const [keyInstructions, setKeyInstructions] = useState('')
  const [submissionRequirements, setSubmissionRequirements] = useState('')
  const [documentsCollected, setDocumentsCollected] = useState('')
  const [questionsAsked, setQuestionsAsked] = useState('')
  const [risksNotes, setRisksNotes] = useState('')
  const [finalNotes, setFinalNotes] = useState('')
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!authLoading) {
      if (!user) router.push('/auth/signin')
      else if (userProfile?.userType !== 'youth-agent') router.push('/dashboard')
    }
  }, [authLoading, user, userProfile, router])

  const uploadFile = async (file: File) => {
    if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name} exceeds 10MB limit`)
    const formData = new FormData()
    formData.append('requestId', requestId)
    formData.append('file', file)
    const res = await authFetch('/api/briefing-reports/upload', {
      method: 'POST',
      body: formData,
    })
    const json = await res.json()
    if (!json.success) throw new Error(json.error || 'Upload failed')
    return json.data.url as string
  }

  const onFilesSelected = async (files: FileList | null) => {
    if (!files?.length || !requestId) return
    setUploading(true)
    try {
      const urls: string[] = []
      for (const file of Array.from(files)) {
        const url = await uploadFile(file)
        urls.push(url)
      }
      setUploadedUrls((prev) => [...prev, ...urls])
      toast.success(`${urls.length} file(s) uploaded`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (!requestId) e.request = 'Missing attendance request ID'
    if (!attendanceConfirmed) e.attendance = 'Confirm whether you attended the briefing'
    if (!briefingNotes.trim()) e.notes = 'Briefing notes are required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!validate() || !user) return

    const summary = [
      '## Attendance',
      attendanceConfirmed === 'yes' ? 'Attendance confirmed' : 'Attendance not confirmed',
      arrivalTime && `Arrival: ${arrivalTime}`,
      briefingStartedTime && `Briefing started: ${briefingStartedTime}`,
      '## Briefing Notes',
      briefingNotes.trim(),
      keyInstructions.trim() && `## Key Instructions\n${keyInstructions.trim()}`,
      documentsCollected.trim() && `## Documents Collected\n${documentsCollected.trim()}`,
      questionsAsked.trim() && `## Questions Asked\n${questionsAsked.trim()}`,
    ]
      .filter(Boolean)
      .join('\n\n')

    const notes = [
      submissionRequirements.trim() &&
        `## Submission Requirements\n${submissionRequirements.trim()}`,
      risksNotes.trim() && `## Risks / Clarifications\n${risksNotes.trim()}`,
      finalNotes.trim() && `## Final Notes\n${finalNotes.trim()}`,
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
          attendanceConfirmed: attendanceConfirmed === 'yes',
          arrivalTime,
          briefingStartedTime,
          keyInstructions,
          submissionRequirements,
          documentsCollected,
          questionsAsked,
          risksClarifications: risksNotes,
          attendanceProofUrl: uploadedUrls[0],
          photoUrls: uploadedUrls,
          documentUrls: uploadedUrls,
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
            Your attendance notes and proof have been recorded. The SME can view the report from My
            Requests.
          </p>
          <Link
            href="/jobs"
            className="mt-8 inline-flex min-h-[44px] items-center justify-center rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Back to Assignments
          </Link>
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
          Structured field report with attendance proof for the SME procurement workspace.
        </p>

        {!requestId && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            Open this form from an assigned briefing to include the correct request reference.
          </p>
        )}

        <form onSubmit={onSubmit} className="mt-8 space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-bold text-slate-900">Request reference</h2>
            <p className="mt-1 font-mono text-sm text-slate-600">{requestId || '—'}</p>
            {errors.request && <p className="mt-2 text-sm text-red-600">{errors.request}</p>}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <h2 className="font-bold text-slate-900">Attendance</h2>
            <label className="block text-sm font-medium text-slate-700">
              Attendance confirmed?
              <select
                className={fieldClass}
                value={attendanceConfirmed}
                onChange={(e) => setAttendanceConfirmed(e.target.value as 'yes' | 'no' | '')}
              >
                <option value="">Select…</option>
                <option value="yes">Yes — attended compulsory briefing</option>
                <option value="no">No — could not attend</option>
              </select>
            </label>
            {errors.attendance && <p className="text-sm text-red-600">{errors.attendance}</p>}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">
                Arrival time
                <input
                  type="time"
                  className={fieldClass}
                  value={arrivalTime}
                  onChange={(e) => setArrivalTime(e.target.value)}
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Briefing started
                <input
                  type="time"
                  className={fieldClass}
                  value={briefingStartedTime}
                  onChange={(e) => setBriefingStartedTime(e.target.value)}
                />
              </label>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <h2 className="font-bold text-slate-900">Briefing intelligence</h2>
            <textarea
              className={fieldClass}
              rows={4}
              required
              value={briefingNotes}
              onChange={(e) => setBriefingNotes(e.target.value)}
              placeholder="Summary of briefing session…"
            />
            {errors.notes && <p className="text-sm text-red-600">{errors.notes}</p>}
            <textarea
              className={fieldClass}
              rows={3}
              value={keyInstructions}
              onChange={(e) => setKeyInstructions(e.target.value)}
              placeholder="Key instructions from officials"
            />
            <textarea
              className={fieldClass}
              rows={3}
              value={submissionRequirements}
              onChange={(e) => setSubmissionRequirements(e.target.value)}
              placeholder="Submission requirements mentioned"
            />
            <textarea
              className={fieldClass}
              rows={2}
              value={documentsCollected}
              onChange={(e) => setDocumentsCollected(e.target.value)}
              placeholder="Documents collected at briefing"
            />
            <textarea
              className={fieldClass}
              rows={2}
              value={questionsAsked}
              onChange={(e) => setQuestionsAsked(e.target.value)}
              placeholder="Questions asked during briefing"
            />
            <textarea
              className={fieldClass}
              rows={2}
              value={risksNotes}
              onChange={(e) => setRisksNotes(e.target.value)}
              placeholder="Risks or clarifications noted"
            />
            <textarea
              className={fieldClass}
              rows={2}
              value={finalNotes}
              onChange={(e) => setFinalNotes(e.target.value)}
              placeholder="Final notes for SME"
            />
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <h2 className="font-bold text-slate-900">Photos / proof upload</h2>
            <p className="text-xs text-slate-500">
              Upload register photos, venue images, or PDF handouts (max 10MB each, images or PDF).
            </p>
            <label className="flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:border-brand-400 hover:bg-brand-50">
              <Upload className="h-4 w-4" aria-hidden />
              {uploading ? 'Uploading…' : 'Choose files'}
              <input
                type="file"
                accept="image/*,application/pdf"
                multiple
                className="sr-only"
                disabled={uploading || !requestId}
                onChange={(e) => void onFilesSelected(e.target.files)}
              />
            </label>
            {uploadedUrls.length > 0 && (
              <ul className="space-y-1 text-xs text-slate-600">
                {uploadedUrls.map((url) => (
                  <li key={url} className="truncate font-mono">
                    {url.split('/').pop()}
                  </li>
                ))}
              </ul>
            )}
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
