'use client'

import { FormEvent, Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

type Preview = {
  requestId: string
  tenderNumber?: string | null
  tenderTitle?: string | null
  briefingDate?: string | null
  briefingTime?: string | null
  briefingVenue?: string | null
  province?: string | null
  instructions?: string | null
  candidateName?: string | null
  payoutCents?: number | null
  acceptanceDeadlineAt?: string | null
  urgency?: string | null
  assignmentSubstate?: string | null
  opsStage?: string | null
  canRespond?: boolean
  expired?: boolean
}

function formatPayout(cents?: number | null) {
  if (cents == null) return null
  return `R${(cents / 100).toFixed(2)}`
}

function RespondInner() {
  const params = useSearchParams()
  const requestId = String(params.get('requestId') || '').trim()
  const token = String(params.get('token') || '').trim()

  const [preview, setPreview] = useState<Preview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [reason, setReason] = useState('')

  const load = useCallback(async () => {
    if (!requestId || !token) {
      setError('This assignment link is incomplete.')
      return
    }
    const res = await fetch(
      `/api/assignments/respond?requestId=${encodeURIComponent(requestId)}&token=${encodeURIComponent(token)}`
    )
    const json = await res.json()
    if (!json.success) {
      setError(json.error || 'Invalid or expired link')
      setPreview(null)
      return
    }
    setPreview(json.data)
    setError(null)
  }, [requestId, token])

  useEffect(() => {
    load().catch(() => setError('Failed to load assignment'))
  }, [load])

  async function respond(decision: 'accept' | 'decline') {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/assignments/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          token,
          decision,
          reason: decision === 'decline' ? reason : undefined,
        }),
      })
      const json = await res.json()
      if (!json.success) {
        setError(json.error || 'Could not submit response')
        return
      }
      setDone(decision === 'accept' ? 'accepted' : 'declined')
      await load()
    } catch {
      setError('Could not submit response')
    } finally {
      setBusy(false)
    }
  }

  function onDecline(e: FormEvent) {
    e.preventDefault()
    void respond('decline')
  }

  if (done === 'accepted') {
    return (
      <main className="mx-auto max-w-lg px-4 py-16">
        <h1 className="text-2xl font-semibold text-slate-900">Assignment accepted</h1>
        <p className="mt-3 text-slate-600">
          Thank you. This briefing is now confirmed against your name. TenderBriefing Operations has
          been updated.
        </p>
      </main>
    )
  }

  if (done === 'declined') {
    return (
      <main className="mx-auto max-w-lg px-4 py-16">
        <h1 className="text-2xl font-semibold text-slate-900">Assignment declined</h1>
        <p className="mt-3 text-slate-600">
          Thanks for letting us know. Operations will dispatch another representative.
        </p>
      </main>
    )
  }

  if (error && !preview) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16">
        <h1 className="text-2xl font-semibold text-slate-900">Link unavailable</h1>
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
    <main className="mx-auto max-w-lg px-4 py-12">
      <p className="text-sm font-medium uppercase tracking-wide text-teal-800">TenderBriefing</p>
      <h1 className="mt-2 text-2xl font-semibold text-slate-900">Briefing assignment</h1>
      <p className="mt-2 text-slate-600">
        Hi {preview.candidateName || 'there'}, please review and accept or decline before the
        deadline.
      </p>

      <dl className="mt-8 space-y-3 rounded-lg border border-slate-200 bg-white p-5 text-sm">
        <div>
          <dt className="text-slate-500">Reference</dt>
          <dd className="font-medium text-slate-900">{preview.requestId}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Tender / RFQ</dt>
          <dd className="font-medium text-slate-900">
            {preview.tenderNumber || '—'}
            {preview.tenderTitle ? ` — ${preview.tenderTitle}` : ''}
          </dd>
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
        {preview.instructions ? (
          <div>
            <dt className="text-slate-500">Instructions</dt>
            <dd className="font-medium text-slate-900">{preview.instructions}</dd>
          </div>
        ) : null}
        {formatPayout(preview.payoutCents) ? (
          <div>
            <dt className="text-slate-500">Agreed payout</dt>
            <dd className="font-medium text-slate-900">{formatPayout(preview.payoutCents)}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-slate-500">Accept by</dt>
          <dd className="font-medium text-slate-900">
            {preview.acceptanceDeadlineAt
              ? new Date(preview.acceptanceDeadlineAt).toLocaleString('en-ZA', {
                  timeZone: 'Africa/Johannesburg',
                })
              : '—'}
            {preview.urgency ? ` (${preview.urgency})` : ''}
          </dd>
        </div>
      </dl>

      {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}

      {!preview.canRespond || preview.expired ? (
        <p className="mt-6 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This dispatch is no longer open for response
          {preview.assignmentSubstate ? ` (${preview.assignmentSubstate})` : ''}.
        </p>
      ) : (
        <div className="mt-8 space-y-4">
          <button
            type="button"
            disabled={busy}
            onClick={() => void respond('accept')}
            className="w-full rounded-md bg-teal-800 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-900 disabled:opacity-60"
          >
            Accept assignment
          </button>
          <form onSubmit={onDecline} className="space-y-3 border-t border-slate-200 pt-4">
            <label className="block text-sm text-slate-600">
              Decline reason (optional)
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900"
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-md border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
            >
              Decline assignment
            </button>
          </form>
        </div>
      )}
    </main>
  )
}

export default function AssignmentRespondPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-lg px-4 py-16">Loading…</main>}>
      <RespondInner />
    </Suspense>
  )
}
