'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'react-hot-toast'
import { Upload, CheckCircle2, Image as ImageIcon, FileText } from 'lucide-react'
import WorkspaceShell from '@/components/agent/workspace/WorkspaceShell'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { useAuth } from '@/components/providers/AuthProvider'
import { auth } from '@/lib/firebase'

const steps = [
  { id: 1, label: 'Audio recording' },
  { id: 2, label: 'Attendance evidence' },
  { id: 3, label: 'Structured observations' },
  { id: 4, label: 'Review & submit' },
] as const

const MAX_AUDIO_BYTES = 100 * 1024 * 1024

function formatBytes(bytes: number) {
  const mb = bytes / (1024 * 1024)
  if (mb >= 1) return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`
  const kb = bytes / 1024
  if (kb >= 1) return `${kb.toFixed(0)} KB`
  return `${bytes} B`
}

function isAllowedAudioFile(file: File) {
  const allowedMime = new Set(['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/aac'])
  const extAllowed = /\.(mp3|m4a|wav|aac)$/i.test(file.name)
  return allowedMime.has(file.type) || extAllowed
}

function isAllowedEvidenceFile(file: File) {
  const allowedMimePrefixes = ['image/', 'application/pdf']
  const mimeOk = file.type && allowedMimePrefixes.some((p) => file.type === p)
  const extOk = /\.(png|jpe?g|gif|webp|bmp|pdf)$/i.test(file.name)
  return Boolean(mimeOk || extOk)
}

async function uploadFormDataWithProgress({
  endpoint,
  formData,
  onProgress,
}: {
  endpoint: string
  formData: FormData
  onProgress: (pct: number) => void
}): Promise<any> {
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw new Error('Authentication required')

  return await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', endpoint, true)
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)

    xhr.upload.onprogress = (evt) => {
      if (!evt.lengthComputable) return
      const pct = Math.round((evt.loaded / evt.total) * 100)
      onProgress(pct)
    }

    xhr.onload = () => {
      try {
        const json = JSON.parse(xhr.responseText || '{}')
        if (xhr.status >= 200 && xhr.status < 300 && json.success) {
          resolve(json.data || {})
          return
        }
        reject(
          new Error(
            json.error || `Upload failed (${xhr.status || 'unknown status'})`
          )
        )
      } catch (e) {
        reject(e instanceof Error ? e : new Error('Upload failed'))
      }
    }

    xhr.onerror = () => reject(new Error('Upload failed'))

    xhr.send(formData)
  })
}

type AudioState = {
  file?: File
  error?: string
}

type EvidenceState = {
  file: File
  previewUrl?: string
  error?: string
}

export default function SubmitEvidenceWizardPage() {
  const params = useParams<{ requestId: string }>()
  const requestId = String(params.requestId || '')

  const router = useRouter()
  const { user, userProfile, loading: authLoading } = useAuth()

  const [step, setStep] = useState<(typeof steps)[number]['id']>(1)
  const [audio, setAudio] = useState<AudioState>({})
  const [evidence, setEvidence] = useState<EvidenceState[]>([])

  const [arrivalTime, setArrivalTime] = useState('')
  const [briefingStartTime, setBriefingStartTime] = useState('')
  const [briefingEndTime, setBriefingEndTime] = useState('')
  const [approxAttendees, setApproxAttendees] = useState<string>('')
  const [siteInspection, setSiteInspection] = useState(false)
  const [docsDistributed, setDocsDistributed] = useState(false)
  const [importantAnnouncement, setImportantAnnouncement] = useState(false)
  const [shortNote, setShortNote] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [submissionProgress, setSubmissionProgress] = useState(0)
  const [submittedReportId, setSubmittedReportId] = useState<string | null>(null)
  const previewsRef = useRef<string[]>([])

  useEffect(() => {
    if (!authLoading) {
      if (!user) router.push('/auth/signin')
      else if (userProfile?.userType !== 'youth-agent') router.push('/dashboard')
    }
  }, [authLoading, user, userProfile, router])

  useEffect(() => {
    return () => {
      // Clean object URLs (best-effort).
      previewsRef.current.forEach((u) => {
        try {
          URL.revokeObjectURL(u)
        } catch {
          /* noop */
        }
      })
      previewsRef.current = []
    }
  }, [])

  async function handleAudioSelected(file: File) {
    if (!requestId) return toast.error('Missing request id')
    if (!isAllowedAudioFile(file)) return toast.error('Unsupported audio type')
    if (file.size > MAX_AUDIO_BYTES) return toast.error('Audio exceeds 100MB limit')

    setAudio({ file, error: undefined })
    toast.success('Audio selected')
  }

  async function handleEvidenceSelected(files: FileList | null) {
    if (!files?.length) return
    if (!requestId) return toast.error('Missing request id')

    const MAX_IMAGE_BYTES = 10 * 1024 * 1024 // Align with backend validation
    const MAX_IMAGES = 10

    const selected = Array.from(files).filter(isAllowedEvidenceFile)
    if (selected.length === 0) return toast.error('Please upload images or PDF files')
    if (selected.length > MAX_IMAGES) {
      return toast.error(`At most ${MAX_IMAGES} attendance files allowed`)
    }

    const tooLarge = selected.find((f) => f.size > MAX_IMAGE_BYTES)
    if (tooLarge) return toast.error(`Image exceeds 10MB: ${tooLarge.name}`)

    const states: EvidenceState[] = selected.map((file) => {
      const url = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
      if (url) previewsRef.current.push(url)
      return { file, previewUrl: url, error: undefined }
    })
    setEvidence(states)
  }

  const selectedAudioFile = audio.file
  const selectedEvidenceFiles = evidence.map((e) => e.file)

  function canGoNextFromStep1() {
    return Boolean(selectedAudioFile)
  }

  function canGoNextFromStep2() {
    return selectedEvidenceFiles.length > 0
  }

  function canGoNextFromStep3() {
    if (!arrivalTime) return false
    if (!briefingStartTime) return false
    if (!briefingEndTime) return false
    if (shortNote.length > 500) return false
    return true
  }

  async function handleSubmit() {
    if (!requestId) return toast.error('Missing request id')
    if (!selectedAudioFile) return toast.error('Select audio first')
    if (selectedEvidenceFiles.length === 0) return toast.error('Select attendance evidence')
    if (!canGoNextFromStep3()) return toast.error('Complete the structured observations')

    setSubmitting(true)
    setSubmissionProgress(0)
    try {
      const endpoint = `/api/briefing-intelligence/evidence`
      const formData = new FormData()
      formData.append('requestId', requestId)
      formData.append('audio', selectedAudioFile)
      formData.append(
        'observations',
        JSON.stringify({
          arrivalTime,
          briefingStartTime,
          briefingEndTime,
          approxAttendees: approxAttendees ? Number(approxAttendees) : null,
          siteInspection,
          docsDistributed,
          importantAnnouncement,
          shortNote: shortNote.trim() || null,
        })
      )
      selectedEvidenceFiles.forEach((f) => formData.append('attendanceImages', f))

      const jsonData = await uploadFormDataWithProgress({
        endpoint,
        formData,
        onProgress: (pct) => setSubmissionProgress(pct),
      })

      const reportId = String(jsonData?.reportId || jsonData?.id || '')
      if (!reportId) throw new Error('No report id returned')

      toast.success('Report submitted')
      setSubmittedReportId(reportId)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Submission failed')
    } finally {
      setSubmitting(false)
      setSubmissionProgress(0)
    }
  }

  if (submittedReportId) {
    return (
      <WorkspaceShell title="Submit evidence">
        <div className="space-y-6 py-2">
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50/30 p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-6 w-6 text-emerald-700" />
              <div>
                <h2 className="text-lg font-bold text-slate-900">Submission complete</h2>
                <p className="mt-1 text-sm text-slate-700">
                  Your Intelligence Report has been created successfully.
                </p>
              </div>
            </div>
            <div className="mt-4 rounded-xl bg-white p-3 ring-1 ring-slate-200">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Report ID</p>
              <p className="mt-1 font-mono text-sm text-slate-900">{submittedReportId}</p>
            </div>
            <div className="mt-4 flex gap-2">
              <Link
                href="/agent/workspace/assignments"
                className="flex-1 rounded-lg bg-brand-600 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-brand-700"
              >
                Back to assignments
              </Link>
              <button
                type="button"
                onClick={() => router.push(`/agent/workspace/briefing-reports/${submittedReportId}`)}
                className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                View report
              </button>
            </div>
          </section>
        </div>
      </WorkspaceShell>
    )
  }

  return (
    <WorkspaceShell title="Submit evidence">
      <div className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">
                Briefing intelligence · {requestId ? `#${requestId}` : '—'}
              </p>
              <h2 className="mt-1 text-lg font-bold text-slate-900">4-step evidence submission</h2>
            </div>
            <div className="text-right text-xs text-slate-500">
              Step {step} / 4
            </div>
          </div>

          <ol className="mt-4 grid grid-cols-4 gap-2" aria-label="Progress">
            {steps.map((s) => {
              const state =
                s.id < step ? 'done' : s.id === step ? 'active' : 'upcoming'
              return (
                <li key={s.id} className="flex flex-col items-center">
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-full border text-xs font-bold ${
                      state === 'done'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : state === 'active'
                          ? 'border-brand-200 bg-brand-50 text-brand-800'
                          : 'border-slate-200 bg-white text-slate-400'
                    }`}
                  >
                    {state === 'done' ? <CheckCircle2 className="h-4 w-4" /> : s.id}
                  </span>
                  <span className="mt-2 line-clamp-2 text-center text-[10px] font-semibold text-slate-600">
                    {s.label}
                  </span>
                </li>
              )
            })}
          </ol>
        </section>

        <form
          onSubmit={(e) => {
            e.preventDefault()
          }}
          className="space-y-5"
        >
          {step === 1 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-bold text-slate-900">Step 1 · Upload audio recording</h3>
              <p className="mt-1 text-sm text-slate-600">
                Upload your MP3/M4A/WAV/AAC recording. Maximum size: <span className="font-semibold">100MB</span>.
              </p>

              <div className="mt-4">
                <label
                  className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition ${
                    audio.file
                      ? 'border-emerald-200 bg-emerald-50/30'
                      : 'border-slate-300 hover:border-brand-300 hover:bg-brand-50/30'
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault()
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    const f = e.dataTransfer.files?.[0]
                    if (f) void handleAudioSelected(f)
                  }}
                >
                  <Upload className="h-5 w-5 text-brand-700" />
                  <span className="text-sm font-semibold text-slate-800">
                    {audio.file ? 'Audio selected' : 'Drag & drop audio here (or click to choose)'}
                  </span>
                  <input
                    type="file"
                    accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/aac"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) void handleAudioSelected(f)
                    }}
                    disabled={submitting}
                  />
                </label>

                {audio.file && (
                  <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-mono text-sm text-slate-900">{audio.file.name}</p>
                        <p className="mt-1 text-xs text-slate-600">{formatBytes(audio.file.size)}</p>
                      </div>
                      {audio.file && (
                        <span className="inline-flex items-center gap-2 rounded-lg bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                          <CheckCircle2 className="h-4 w-4" />
                          Ready
                        </span>
                      )}
                    </div>

                    {audio.error && <p className="mt-2 text-sm text-red-700">{audio.error}</p>}
                  </div>
                )}
              </div>
            </section>
          )}

          {step === 2 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-bold text-slate-900">Step 2 · Upload attendance evidence</h3>
              <p className="mt-1 text-sm text-slate-600">
                Upload at least <span className="font-semibold">1</span> image or PDF proof (register photos, venue images, or handouts).
              </p>

              <div className="mt-4">
                <label
                  className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition hover:border-brand-300 hover:bg-brand-50/30`}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    const list = e.dataTransfer.files
                    void handleEvidenceSelected(list)
                  }}
                >
                  <ImageIcon className="h-5 w-5 text-brand-700" />
                  <span className="text-sm font-semibold text-slate-800">
                    Drag & drop files here (or click to choose)
                  </span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    multiple
                    className="hidden"
                    disabled={submitting}
                    onChange={(e) => void handleEvidenceSelected(e.target.files)}
                  />
                </label>
              </div>

              {evidence.length > 0 && (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Selected evidence
                    </p>
                    <p className="text-xs text-slate-500">{evidence.length} file(s)</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {evidence.map((it, idx) => (
                      <div key={`${it.file.name}-${idx}`} className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                        <div className="overflow-hidden rounded-lg bg-white">
                          {it.previewUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={it.previewUrl}
                              alt={it.file.name}
                              className="h-24 w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-24 flex-col items-center justify-center gap-1">
                              <FileText className="h-5 w-5 text-slate-500" />
                              <span className="text-[11px] font-semibold text-slate-600">PDF</span>
                            </div>
                          )}
                        </div>

                        <p className="mt-2 truncate text-[11px] font-semibold text-slate-700">{it.file.name}</p>
                        {it.error && <p className="mt-2 text-[11px] font-semibold text-red-700">{it.error}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {step === 3 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-bold text-slate-900">Step 3 · Structured observations</h3>
              <p className="mt-1 text-sm text-slate-600">
                Provide factual time and attendance observations. Keep notes brief.
              </p>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-slate-800">Arrival time</span>
                  <input
                    type="time"
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    value={arrivalTime}
                    onChange={(e) => setArrivalTime(e.target.value)}
                    required
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-slate-800">Approx attendees</span>
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    value={approxAttendees}
                    onChange={(e) => setApproxAttendees(e.target.value)}
                    placeholder="Optional"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-slate-800">Briefing start time</span>
                  <input
                    type="time"
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    value={briefingStartTime}
                    onChange={(e) => setBriefingStartTime(e.target.value)}
                    required
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-slate-800">Briefing end time</span>
                  <input
                    type="time"
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    value={briefingEndTime}
                    onChange={(e) => setBriefingEndTime(e.target.value)}
                    required
                  />
                </label>
              </div>

              <div className="mt-4 space-y-3">
                <ToggleRow
                  label="Site inspection performed"
                  description="Were inspections of the site/venue carried out?"
                  value={siteInspection}
                  onChange={setSiteInspection}
                />
                <ToggleRow
                  label="Docs distributed"
                  description="Were tender documents / handouts distributed?"
                  value={docsDistributed}
                  onChange={setDocsDistributed}
                />
                <ToggleRow
                  label="Important announcement"
                  description="Was any key information announced to attendees?"
                  value={importantAnnouncement}
                  onChange={setImportantAnnouncement}
                />
              </div>

              <div className="mt-4">
                <label className="block">
                  <span className="text-sm font-semibold text-slate-800">Short note (optional)</span>
                  <textarea
                    className="mt-1 min-h-[110px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    value={shortNote}
                    maxLength={500}
                    onChange={(e) => setShortNote(e.target.value)}
                    placeholder="Any clarifications, outcomes, or key operational notes…"
                  />
                  <p className="mt-1 text-right text-xs text-slate-500">{shortNote.length}/500</p>
                </label>
              </div>
            </section>
          )}

          {step === 4 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-bold text-slate-900">Step 4 · Review & submit</h3>
              <p className="mt-1 text-sm text-slate-600">Confirm your submission details before creating the report.</p>

              <div className="mt-4 space-y-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Audio</p>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm text-slate-900">
                        {audio.file?.name || '—'}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">Ready for submission</p>
                    </div>
                    <span className="inline-flex items-center gap-2 rounded-lg bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                      <CheckCircle2 className="h-4 w-4" />
                      Ready
                    </span>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                    Attendance evidence
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {evidence.length} file(s) ready
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {evidence.slice(0, 6).map((it, idx) => (
                      <span
                        key={`${it.file.name}-${idx}`}
                        className="inline-flex items-center rounded-lg bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200"
                      >
                        {it.file.name.length > 16 ? it.file.name.slice(0, 16) + '…' : it.file.name}
                      </span>
                    ))}
                    {evidence.length > 6 && (
                      <span className="inline-flex items-center rounded-lg bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200">
                        +{evidence.length - 6} more
                      </span>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Structured observations</p>
                  <div className="mt-3 space-y-1 text-sm text-slate-800">
                    <p>
                      Arrival: <span className="font-semibold">{arrivalTime || '—'}</span>
                    </p>
                    <p>
                      Briefing: <span className="font-semibold">{briefingStartTime || '—'}</span>–{' '}
                      <span className="font-semibold">{briefingEndTime || '—'}</span>
                    </p>
                    <p>
                      Approx attendees: <span className="font-semibold">{approxAttendees || '—'}</span>
                    </p>
                    <p>
                      Site inspection: <span className="font-semibold">{siteInspection ? 'Yes' : 'No'}</span>
                    </p>
                    <p>
                      Docs distributed: <span className="font-semibold">{docsDistributed ? 'Yes' : 'No'}</span>
                    </p>
                    <p>
                      Important announcement: <span className="font-semibold">{importantAnnouncement ? 'Yes' : 'No'}</span>
                    </p>
                    {shortNote.trim() && (
                      <p className="pt-1 text-slate-700">
                        Note: <span className="font-semibold">{shortNote.trim().slice(0, 120)}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {submitting && (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
                    <span>Upload progress</span>
                    <span>{submissionProgress}%</span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full bg-brand-600 transition-[width] duration-150"
                      style={{ width: `${submissionProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  disabled={submitting}
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={submitting}
                  className="flex-1 rounded-lg bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {submitting ? (
                    <span className="inline-flex items-center gap-2">
                      <LoadingSpinner size="sm" />
                      Submitting…
                    </span>
                  ) : (
                    'Submit Intelligence Report'
                  )}
                </button>
              </div>
            </section>
          )}

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setStep((s) => (Math.max(1, s - 1) as typeof step))}
              disabled={step === 1 || submitting}
              className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
            >
              Back
            </button>
            <div className="flex items-center gap-2">
              {step < 4 ? (
                <button
                  type="button"
                  onClick={() => setStep((s) => Math.min(4, s + 1) as any)}
                  disabled={
                    submitting ||
                    (step === 1 && !canGoNextFromStep1()) ||
                    (step === 2 && !canGoNextFromStep2()) ||
                    (step === 3 && !canGoNextFromStep3())
                  }
                  className="rounded-lg bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  Continue
                </button>
              ) : (
                <span className="text-xs text-slate-500">Ready to submit</span>
              )}
            </div>
          </div>
        </form>
      </div>
    </WorkspaceShell>
  )
}

function ToggleRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string
  description: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:bg-slate-50"
      role="switch"
      aria-checked={value}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-900">{label}</p>
          <p className="mt-1 text-xs text-slate-600">{description}</p>
        </div>
        <span
          className={`inline-flex h-8 w-14 items-center rounded-full px-1 transition ${
            value ? 'bg-emerald-100' : 'bg-slate-100'
          }`}
        >
          <span
            className={`h-6 w-6 rounded-full bg-white shadow-sm ring-1 ring-slate-200 transition-transform ${
              value ? 'translate-x-6' : 'translate-x-0'
            }`}
          />
        </span>
      </div>
    </button>
  )
}

