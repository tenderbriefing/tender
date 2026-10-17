'use client'

import { FormEvent, Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

type FieldPreview = {
  requestId: string
  tenderNumber?: string | null
  tenderTitle?: string | null
  procuringEntity?: string | null
  briefingDate?: string | null
  briefingTime?: string | null
  briefingVenue?: string | null
  province?: string | null
  contactPerson?: string | null
  contactPhone?: string | null
  assignmentInstructions?: string | null
  representativeName?: string | null
  payoutCents?: number | null
  opsStage?: string | null
  fieldSubstate?: string | null
  checkedInAt?: string | null
  attended?: boolean
  attendedAt?: string | null
  evidenceCount?: number
  evidenceReviewStatus?: string | null
  fieldNotes?: string
  locationCaptured?: boolean
}

function formatPayout(cents?: number | null) {
  if (cents == null) return '—'
  return `R${(cents / 100).toFixed(2)}`
}

function FieldInner() {
  const params = useSearchParams()
  const requestId = String(params.get('requestId') || '').trim()
  const token = String(params.get('token') || '').trim()

  const [preview, setPreview] = useState<FieldPreview | null>(null)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [category, setCategory] = useState('attendance_proof')

  const load = useCallback(async () => {
    if (!requestId || !token) {
      setError('This field link is incomplete.')
      return
    }
    const res = await fetch(
      `/api/assignments/field?requestId=${encodeURIComponent(requestId)}&token=${encodeURIComponent(token)}`
    )
    const json = await res.json()
    if (!json.success) {
      setError(json.error || 'Unable to load assignment')
      setPreview(null)
      return
    }
    setPreview(json.data)
    setNotes(json.data.fieldNotes || '')
    setError(null)
  }, [requestId, token])

  useEffect(() => {
    load().catch(() => setError('Failed to load assignment'))
  }, [load])

  // Autosave notes (debounced lightly via blur + periodic)
  useEffect(() => {
    if (!preview || notes === (preview.fieldNotes || '')) return
    const t = setTimeout(() => {
      void fetch('/api/assignments/field', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, token, action: 'save_notes', notes }),
      })
    }, 1200)
    return () => clearTimeout(t)
  }, [notes, preview, requestId, token])

  async function postJson(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true)
    setError(null)
    setInfo(null)
    try {
      const res = await fetch('/api/assignments/field', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, token, action, ...extra }),
      })
      const json = await res.json()
      if (!json.success) {
        setError(json.error || 'Action failed')
        return json
      }
      if (json.data?.preview) {
        setPreview(json.data.preview)
        setNotes(json.data.preview.fieldNotes || notes)
      }
      if (json.data?.result?.warning) setInfo(json.data.result.warning)
      else if (json.data?.result?.ok === false) setInfo(json.data.result.warning || 'Incomplete')
      else setInfo(`${action.replace(/_/g, ' ')} OK`)
      return json
    } catch {
      setError('Action failed')
      return null
    } finally {
      setBusy(false)
    }
  }

  async function onCheckIn() {
    let lat: number | null = null
    let lng: number | null = null
    let accuracy: number | null = null
    let locationDenied = false
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 8000,
          })
        })
        lat = pos.coords.latitude
        lng = pos.coords.longitude
        accuracy = pos.coords.accuracy
      } catch {
        locationDenied = true
      }
    } else {
      locationDenied = true
    }
    await postJson('check_in', { lat, lng, accuracy, locationDenied })
  }

  async function onUpload(e: FormEvent) {
    e.preventDefault()
    if (!file) {
      setError('Choose a file first')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.set('requestId', requestId)
      fd.set('token', token)
      fd.set('action', 'upload_evidence')
      fd.set('category', category)
      fd.set('file', file)
      const res = await fetch('/api/assignments/field', { method: 'POST', body: fd })
      const json = await res.json()
      if (!json.success) {
        setError(json.error || 'Upload failed')
        return
      }
      if (json.data?.preview) setPreview(json.data.preview)
      setInfo('Evidence uploaded')
      setFile(null)
    } catch {
      setError('Upload failed')
    } finally {
      setBusy(false)
    }
  }

  if (error && !preview) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16">
        <h1 className="text-2xl font-semibold text-slate-900">Field assignment</h1>
        <p className="mt-3 text-slate-600">{error}</p>
      </main>
    )
  }

  if (!preview) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16">
        <p className="text-slate-600">Loading assignment…</p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-10 pb-24">
      <p className="text-sm font-medium uppercase tracking-wide text-teal-800">TenderBriefing</p>
      <h1 className="mt-2 text-2xl font-semibold text-slate-900">Field assignment</h1>
      <p className="mt-1 text-sm text-slate-600">
        {preview.representativeName || 'Representative'} · status{' '}
        <strong>{preview.fieldSubstate || preview.opsStage || 'assigned'}</strong>
      </p>

      <dl className="mt-6 space-y-3 rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <div>
          <dt className="text-slate-500">Tender / RFQ</dt>
          <dd className="font-medium text-slate-900">
            {preview.tenderNumber || '—'}
            {preview.tenderTitle ? ` — ${preview.tenderTitle}` : ''}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Procuring entity</dt>
          <dd className="font-medium text-slate-900">{preview.procuringEntity || '—'}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Briefing</dt>
          <dd className="font-medium text-slate-900">
            {[preview.briefingDate, preview.briefingTime].filter(Boolean).join(' · ') || '—'}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Venue</dt>
          <dd className="font-medium text-slate-900">
            {[preview.briefingVenue, preview.province].filter(Boolean).join(', ') || '—'}
          </dd>
        </div>
        {(preview.contactPerson || preview.contactPhone) && (
          <div>
            <dt className="text-slate-500">Contact</dt>
            <dd className="font-medium text-slate-900">
              {[preview.contactPerson, preview.contactPhone].filter(Boolean).join(' · ')}
            </dd>
          </div>
        )}
        {preview.assignmentInstructions ? (
          <div>
            <dt className="text-slate-500">Instructions</dt>
            <dd className="font-medium text-slate-900">{preview.assignmentInstructions}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-slate-500">Payout</dt>
          <dd className="font-medium text-slate-900">{formatPayout(preview.payoutCents)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Check-in</dt>
          <dd className="font-medium text-slate-900">
            {preview.checkedInAt
              ? new Date(preview.checkedInAt).toLocaleString('en-ZA', {
                  timeZone: 'Africa/Johannesburg',
                })
              : 'Not checked in'}
            {preview.locationCaptured ? ' · location captured' : ''}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Evidence</dt>
          <dd className="font-medium text-slate-900">{preview.evidenceCount || 0} item(s)</dd>
        </div>
      </dl>

      {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
      {info ? <p className="mt-4 text-sm text-teal-800">{info}</p> : null}

      <div className="mt-6 space-y-3">
        <button
          type="button"
          disabled={busy || Boolean(preview.checkedInAt)}
          onClick={() => void onCheckIn()}
          className="w-full rounded-md bg-teal-800 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {preview.checkedInAt ? 'Checked in' : 'Check in'}
        </button>
        <p className="text-xs text-slate-500">
          Location is optional. Check-in still works if you deny location permission.
        </p>
      </div>

      <form onSubmit={onUpload} className="mt-8 space-y-3 rounded-lg border border-slate-200 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
          Upload evidence
        </h2>
        <label className="block text-sm">
          Category
          <select
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="attendance_proof">Attendance proof</option>
            <option value="site_photos">Site photos</option>
            <option value="briefing_photos">Briefing photos</option>
            <option value="documents">Documents (PDF)</option>
            <option value="notes">Notes</option>
            <option value="other">Other / audio</option>
          </select>
        </label>
        <input
          type="file"
          accept="image/*,application/pdf,audio/*,.pdf,.mp3,.m4a,.webm,.wav"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="block w-full text-sm"
        />
        <button
          type="submit"
          disabled={busy || !file}
          className="w-full rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          Upload
        </button>
      </form>

      <label className="mt-8 block text-sm">
        Field notes
        <textarea
          rows={6}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Key briefing points, compulsory requirements, Q&A, site observations…"
        />
      </label>

      <button
        type="button"
        disabled={busy || preview.attended}
        onClick={() => void postJson('confirm_attendance', { notes })}
        className="mt-6 w-full rounded-md bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {preview.attended ? 'Attendance submitted' : 'Confirm attendance & submit evidence'}
      </button>
    </main>
  )
}

export default function FieldAssignmentPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-lg px-4 py-16">Loading…</main>}>
      <FieldInner />
    </Suspense>
  )
}
