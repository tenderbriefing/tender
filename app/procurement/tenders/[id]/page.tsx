'use client'

import { useParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { authFetch } from '@/lib/api/authenticatedFetch'
import { PRIVATE_TENDER_PROVINCES } from '@/lib/privateTenders/constants'
import {
  canOrganisationWithdraw,
  PRIVATE_TENDER_STATUS_LABELS,
} from '@/lib/privateTenders/statusMachine'

const FIELDS = [
  'title',
  'tenderReference',
  'description',
  'category',
  'province',
  'municipality',
  'closingDate',
  'closingTime',
  'briefingDate',
  'briefingTime',
  'briefingVenue',
  'briefingInstructions',
  'eligibilityRequirements',
  'submissionInstructions',
  'contactPersonName',
  'contactEmail',
  'contactPhone',
] as const

export default function ProcurementTenderDetailPage() {
  const params = useParams()
  const id = String(params?.id || '')
  const router = useRouter()
  const [tender, setTender] = useState<any>(null)
  const [form, setForm] = useState<Record<string, string>>({})
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await authFetch(`/api/procurement/tenders/${id}`)
    const json = await res.json()
    if (!res.ok) {
      setError(json?.error || 'Not found')
      return
    }
    const t = json.data.tender
    setTender(t)
    const next: Record<string, string> = {}
    for (const key of FIELDS) next[key] = t[key] || ''
    setForm(next)
  }, [id])

  useEffect(() => {
    if (id) void load()
  }, [id, load])

  const editable =
    tender && (tender.status === 'draft' || tender.status === 'changes_requested')

  async function saveDraft() {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const res = await authFetch(`/api/procurement/tenders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json?.error || 'Save failed')
        return
      }
      setTender(json.data.tender)
      setSavedAt(new Date().toLocaleTimeString())
      setMessage('Draft saved')
    } finally {
      setBusy(false)
    }
  }

  async function uploadDocument(file: File) {
    setBusy(true)
    setError(null)
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result || ''))
        reader.onerror = () => reject(new Error('read failed'))
        reader.readAsDataURL(file)
      })
      const upload = await fetch('/api/private-tenders/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type || 'application/pdf',
          file: dataUrl,
          kind: 'tender_document',
          submissionDraftId: id,
        }),
      })
      const upJson = await upload.json()
      if (!upload.ok) {
        setError(upJson?.error || 'Upload failed')
        return
      }
      const res = await authFetch(`/api/procurement/tenders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, tenderDocument: upJson.data }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json?.error || 'Failed to attach document')
        return
      }
      setTender(json.data.tender)
      setMessage('Document uploaded')
    } finally {
      setBusy(false)
    }
  }

  async function submitForReview() {
    setBusy(true)
    setError(null)
    try {
      await saveDraft()
      const res = await authFetch(`/api/procurement/tenders/${id}/submit`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) {
        setError(
          json?.issues
            ? json.issues.map((i: any) => i.message).join('; ')
            : json?.error || 'Submit failed'
        )
        return
      }
      setTender(json.data.tender)
      setMessage('Submitted for Founder review')
    } finally {
      setBusy(false)
    }
  }

  async function withdraw() {
    if (!confirm('Withdraw this tender submission?')) return
    setBusy(true)
    try {
      const res = await authFetch(`/api/procurement/tenders/${id}/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json?.error || 'Withdraw failed')
        return
      }
      setTender(json.data.tender)
      setMessage('Withdrawn')
    } finally {
      setBusy(false)
    }
  }

  async function duplicate() {
    setBusy(true)
    try {
      const res = await authFetch(`/api/procurement/tenders/${id}/duplicate`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) {
        setError(json?.error || 'Duplicate failed')
        return
      }
      router.push(`/procurement/tenders/${json.data.tender.id}`)
    } finally {
      setBusy(false)
    }
  }

  if (error && !tender) {
    return <p className="text-sm text-red-600">{error}</p>
  }
  if (!tender) {
    return <p className="text-sm text-slate-600">Loading…</p>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {PRIVATE_TENDER_STATUS_LABELS[tender.status as keyof typeof PRIVATE_TENDER_STATUS_LABELS] ||
              tender.status}
          </p>
          <h1 className="text-2xl font-bold text-brand-950">
            {tender.title || 'Untitled draft'}
          </h1>
          {savedAt && <p className="mt-1 text-xs text-slate-500">Saved at {savedAt}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {editable && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={saveDraft}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold"
              >
                Save Draft
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={submitForReview}
                className="rounded-xl bg-brand-800 px-4 py-2 text-sm font-semibold text-white"
              >
                Submit for Review
              </button>
            </>
          )}
          {canOrganisationWithdraw(tender.status) && (
            <button
              type="button"
              disabled={busy}
              onClick={withdraw}
              className="rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-700"
            >
              Withdraw
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={duplicate}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold"
          >
            Duplicate Tender
          </button>
        </div>
      </div>

      {tender.status === 'changes_requested' && tender.changesRequestedNote && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-semibold">Founder feedback</p>
          {tender.changesRequestedCategory && (
            <p className="mt-1 text-xs uppercase tracking-wide">{tender.changesRequestedCategory}</p>
          )}
          <p className="mt-2 whitespace-pre-wrap">{tender.changesRequestedNote}</p>
        </div>
      )}

      {message && <p className="text-sm text-emerald-700">{message}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
        {FIELDS.map((key) => (
          <label key={key} className={key === 'description' ? 'sm:col-span-2' : ''}>
            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              {key}
            </span>
            {key === 'description' || key === 'briefingInstructions' || key === 'eligibilityRequirements' || key === 'submissionInstructions' ? (
              <textarea
                disabled={!editable}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                rows={4}
                value={form[key] || ''}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              />
            ) : key === 'province' ? (
              <select
                disabled={!editable}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={form[key] || ''}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              >
                <option value="">Select province</option>
                {PRIVATE_TENDER_PROVINCES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            ) : (
              <input
                disabled={!editable}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={form[key] || ''}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              />
            )}
          </label>
        ))}

        <div className="sm:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Tender document
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {tender.tenderDocument?.fileName || 'No document uploaded'}
          </p>
          {editable && (
            <input
              type="file"
              accept=".pdf,.doc,.docx,application/pdf"
              className="mt-2 block text-sm"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void uploadDocument(file)
              }}
            />
          )}
        </div>
      </div>

      {tender.publishedTenderId && (
        <p className="text-sm text-slate-600">
          Published as{' '}
          <a className="font-semibold text-brand-800" href={`/tenders/${tender.publishedTenderId}`}>
            {tender.publishedTenderId}
          </a>
        </p>
      )}
    </div>
  )
}
