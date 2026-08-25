'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { PRIVATE_TENDER_PROVINCES } from '@/lib/privateTenders/constants'
import type { PrivateTenderDocumentMeta } from '@/lib/privateTenders/types'

type FormState = {
  companyName: string
  registrationNumber: string
  website: string
  contactPersonName: string
  contactEmail: string
  contactPhone: string
  title: string
  tenderReference: string
  description: string
  category: string
  province: string
  municipality: string
  closingDate: string
  closingTime: string
  briefingDate: string
  briefingTime: string
  briefingVenue: string
  briefingInstructions: string
  registrationRequired: boolean
  registrationInstructions: string
  virtualBriefing: boolean
  meetingLink: string
  eligibilityRequirements: string
  submissionInstructions: string
  procurementContactName: string
  procurementContactEmail: string
  procurementContactPhone: string
  websiteUrl: string
}

const STEPS = [
  'Company',
  'Tender',
  'Briefing',
  'Documents',
  'Instructions',
  'Review',
] as const

const initial: FormState = {
  companyName: '',
  registrationNumber: '',
  website: '',
  contactPersonName: '',
  contactEmail: '',
  contactPhone: '',
  title: '',
  tenderReference: '',
  description: '',
  category: '',
  province: '',
  municipality: '',
  closingDate: '',
  closingTime: '',
  briefingDate: '',
  briefingTime: '10:00',
  briefingVenue: '',
  briefingInstructions: '',
  registrationRequired: false,
  registrationInstructions: '',
  virtualBriefing: false,
  meetingLink: '',
  eligibilityRequirements: '',
  submissionInstructions: '',
  procurementContactName: '',
  procurementContactEmail: '',
  procurementContactPhone: '',
  websiteUrl: '',
}

const fieldClass =
  'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20'
const labelClass = 'block text-sm font-semibold text-slate-800'

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

export default function PrivateTenderSubmitForm() {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<FormState>(initial)
  const [tenderDocument, setTenderDocument] = useState<PrivateTenderDocumentMeta | null>(null)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [issues, setIssues] = useState<Array<{ field: string; message: string }>>([])
  const [done, setDone] = useState<{
    trackingToken: string
    id: string
    title: string
  } | null>(null)
  const [confirmed, setConfirmed] = useState(false)

  const set =
    (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const value =
        e.target.type === 'checkbox'
          ? (e.target as HTMLInputElement).checked
          : e.target.value
      setForm((prev) => ({ ...prev, [key]: value as never }))
    }

  const progressLabel = useMemo(() => `${step + 1} of ${STEPS.length}`, [step])

  async function uploadDocument(file: File) {
    setError(null)
    setUploadProgress(`Uploading ${file.name}…`)
    try {
      const dataUrl = await fileToBase64(file)
      const res = await fetch('/api/private-tenders/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type || 'application/octet-stream',
          file: dataUrl,
          kind: 'tender_document',
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Upload failed')
      }
      setTenderDocument(json.data)
      setUploadProgress(`Uploaded ${file.name}`)
    } catch (err) {
      setUploadProgress(null)
      setError(err instanceof Error ? err.message : 'Upload failed')
    }
  }

  async function onSubmit() {
    if (!confirmed) {
      setError('Please confirm the submission disclaimer before continuing.')
      return
    }
    if (!tenderDocument) {
      setError('Please upload the tender document.')
      setStep(3)
      return
    }
    setSubmitting(true)
    setError(null)
    setIssues([])
    try {
      const res = await fetch('/api/private-tenders/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          briefingRequired: true,
          briefingCompulsory: true,
          tenderDocument,
          supportingDocuments: [],
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        setIssues(json.issues || [])
        throw new Error(json.error || 'Submission failed')
      }
      setDone({
        trackingToken: json.data.trackingToken,
        id: json.data.id,
        title: json.data.title,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-6 sm:p-8">
        <h2 className="text-xl font-bold text-brand-900">Submission received</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">
          <strong>{done.title}</strong> is awaiting Founder verification. Publication is not
          guaranteed. You remain responsible for your procurement process.
        </p>
        <p className="mt-4 text-sm text-slate-600">
          Track status:{' '}
          <Link
            href={`/submit-tender/status/${done.trackingToken}`}
            className="font-semibold text-brand-800 underline"
          >
            View status page
          </Link>
        </p>
        <p className="mt-2 font-mono text-xs text-slate-500">Reference: {done.id}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-600">
          Step {progressLabel}: {STEPS[step]}
        </p>
        <div className="flex gap-1" aria-hidden>
          {STEPS.map((_, i) => (
            <span
              key={STEPS[i]}
              className={`h-1.5 w-8 rounded-full ${i <= step ? 'bg-brand-700' : 'bg-slate-200'}`}
            />
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
          {issues.length > 0 && (
            <ul className="mt-2 list-disc pl-5">
              {issues.map((issue) => (
                <li key={`${issue.field}-${issue.message}`}>
                  {issue.field}: {issue.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {step === 0 && (
        <section className="grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className={labelClass}>Company name *</span>
            <input className={fieldClass} value={form.companyName} onChange={set('companyName')} required />
          </label>
          <label>
            <span className={labelClass}>Registration number</span>
            <input className={fieldClass} value={form.registrationNumber} onChange={set('registrationNumber')} />
          </label>
          <label>
            <span className={labelClass}>Website</span>
            <input className={fieldClass} value={form.website} onChange={set('website')} placeholder="https://" />
          </label>
          <label>
            <span className={labelClass}>Contact person *</span>
            <input className={fieldClass} value={form.contactPersonName} onChange={set('contactPersonName')} required />
          </label>
          <label>
            <span className={labelClass}>Contact email *</span>
            <input type="email" className={fieldClass} value={form.contactEmail} onChange={set('contactEmail')} required />
          </label>
          <label className="sm:col-span-2">
            <span className={labelClass}>Contact phone</span>
            <input className={fieldClass} value={form.contactPhone} onChange={set('contactPhone')} />
          </label>
          {/* Honeypot */}
          <label className="hidden" aria-hidden>
            <span>Website URL</span>
            <input tabIndex={-1} autoComplete="off" value={form.websiteUrl} onChange={set('websiteUrl')} />
          </label>
        </section>
      )}

      {step === 1 && (
        <section className="grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className={labelClass}>Tender title *</span>
            <input className={fieldClass} value={form.title} onChange={set('title')} required />
          </label>
          <label>
            <span className={labelClass}>Tender reference *</span>
            <input className={fieldClass} value={form.tenderReference} onChange={set('tenderReference')} required />
          </label>
          <label>
            <span className={labelClass}>Category *</span>
            <input className={fieldClass} value={form.category} onChange={set('category')} required />
          </label>
          <label>
            <span className={labelClass}>Province *</span>
            <select className={fieldClass} value={form.province} onChange={set('province')} required>
              <option value="">Select province</option>
              {PRIVATE_TENDER_PROVINCES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={labelClass}>Municipality / city</span>
            <input className={fieldClass} value={form.municipality} onChange={set('municipality')} />
          </label>
          <label>
            <span className={labelClass}>Closing date *</span>
            <input type="date" className={fieldClass} value={form.closingDate} onChange={set('closingDate')} required />
          </label>
          <label>
            <span className={labelClass}>Closing time</span>
            <input type="time" className={fieldClass} value={form.closingTime} onChange={set('closingTime')} />
          </label>
          <label className="sm:col-span-2">
            <span className={labelClass}>Description *</span>
            <textarea
              className={`${fieldClass} min-h-[120px]`}
              value={form.description}
              onChange={set('description')}
              required
            />
          </label>
        </section>
      )}

      {step === 2 && (
        <section className="grid gap-4 sm:grid-cols-2">
          <p className="sm:col-span-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Phase 1 requires a <strong>compulsory briefing</strong>. Opportunities without a
            usable briefing session are not eligible for Youth Agent attendance.
          </p>
          <label>
            <span className={labelClass}>Briefing date *</span>
            <input type="date" className={fieldClass} value={form.briefingDate} onChange={set('briefingDate')} required />
          </label>
          <label>
            <span className={labelClass}>Briefing time *</span>
            <input type="time" className={fieldClass} value={form.briefingTime} onChange={set('briefingTime')} required />
          </label>
          <label className="sm:col-span-2">
            <span className={labelClass}>Venue / location *</span>
            <input className={fieldClass} value={form.briefingVenue} onChange={set('briefingVenue')} required />
          </label>
          <label className="sm:col-span-2">
            <span className={labelClass}>Briefing instructions</span>
            <textarea
              className={`${fieldClass} min-h-[80px]`}
              value={form.briefingInstructions}
              onChange={set('briefingInstructions')}
            />
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
            <input
              type="checkbox"
              checked={form.registrationRequired}
              onChange={set('registrationRequired')}
            />
            Registration required before briefing
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
            <input type="checkbox" checked={form.virtualBriefing} onChange={set('virtualBriefing')} />
            Virtual briefing
          </label>
          {form.registrationRequired && (
            <label className="sm:col-span-2">
              <span className={labelClass}>Registration instructions</span>
              <textarea
                className={`${fieldClass} min-h-[80px]`}
                value={form.registrationInstructions}
                onChange={set('registrationInstructions')}
              />
            </label>
          )}
          {form.virtualBriefing && (
            <label className="sm:col-span-2">
              <span className={labelClass}>Meeting link</span>
              <input className={fieldClass} value={form.meetingLink} onChange={set('meetingLink')} placeholder="https://" />
            </label>
          )}
        </section>
      )}

      {step === 3 && (
        <section className="space-y-4">
          <label className="block">
            <span className={labelClass}>Tender document (PDF, DOC, DOCX) *</span>
            <input
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="mt-2 block w-full text-sm text-slate-700"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void uploadDocument(file)
              }}
            />
          </label>
          {uploadProgress && <p className="text-sm text-slate-600">{uploadProgress}</p>}
          {tenderDocument && (
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              Ready: <strong>{tenderDocument.fileName}</strong> (
              {Math.round(tenderDocument.sizeBytes / 1024)} KB)
            </p>
          )}
        </section>
      )}

      {step === 4 && (
        <section className="grid gap-4">
          <label>
            <span className={labelClass}>Eligibility requirements</span>
            <textarea
              className={`${fieldClass} min-h-[90px]`}
              value={form.eligibilityRequirements}
              onChange={set('eligibilityRequirements')}
            />
          </label>
          <label>
            <span className={labelClass}>Submission instructions</span>
            <textarea
              className={`${fieldClass} min-h-[90px]`}
              value={form.submissionInstructions}
              onChange={set('submissionInstructions')}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-3">
            <label>
              <span className={labelClass}>Procurement contact</span>
              <input className={fieldClass} value={form.procurementContactName} onChange={set('procurementContactName')} />
            </label>
            <label>
              <span className={labelClass}>Procurement email</span>
              <input
                type="email"
                className={fieldClass}
                value={form.procurementContactEmail}
                onChange={set('procurementContactEmail')}
              />
            </label>
            <label>
              <span className={labelClass}>Procurement phone</span>
              <input className={fieldClass} value={form.procurementContactPhone} onChange={set('procurementContactPhone')} />
            </label>
          </div>
        </section>
      )}

      {step === 5 && (
        <section className="space-y-4">
          <dl className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Company</dt>
              <dd className="mt-1 font-medium text-slate-900">{form.companyName || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reference</dt>
              <dd className="mt-1 font-medium text-slate-900">{form.tenderReference || '—'}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Title</dt>
              <dd className="mt-1 font-medium text-slate-900">{form.title || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Briefing</dt>
              <dd className="mt-1 font-medium text-slate-900">
                {form.briefingDate} {form.briefingTime}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Closing</dt>
              <dd className="mt-1 font-medium text-slate-900">
                {form.closingDate} {form.closingTime}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Document</dt>
              <dd className="mt-1 font-medium text-slate-900">{tenderDocument?.fileName || 'Missing'}</dd>
            </div>
          </dl>
          <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
            <input
              type="checkbox"
              className="mt-1"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            <span>
              I confirm this submission is accurate, includes a compulsory briefing, and that
              TenderBriefing verification does not guarantee publication or constitute legal
              endorsement. My company remains responsible for procurement evaluation and award.
            </span>
          </label>
        </section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <button
          type="button"
          disabled={step === 0 || submitting}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
        >
          Back
        </button>
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
            className="rounded-xl bg-brand-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-900"
          >
            Continue
          </button>
        ) : (
          <button
            type="button"
            disabled={submitting}
            onClick={() => void onSubmit()}
            className="rounded-xl bg-brand-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-900 disabled:opacity-60"
          >
            {submitting ? 'Submitting…' : 'Submit for verification'}
          </button>
        )}
      </div>
    </div>
  )
}
