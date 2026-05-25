'use client'

import { useCallback, useEffect, useState } from 'react'
import { authFetch } from '@/lib/api/authenticatedFetch'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

type IngestedEmail = {
  id: string
  subject?: string
  fromEmail?: string
  status?: string
  forwardedByUid?: string
  extraction?: {
    title?: string
    readiness?: {
      confidence?: number
      dispatchEligible?: boolean
      missingFields?: string[]
      dispatchReadiness?: string
    }
  }
  duplicateRisk?: { duplicate?: boolean; reason?: string }
  convertedTenderId?: string
}

export default function ProcurementInboxPanel() {
  const [items, setItems] = useState<IngestedEmail[]>([])
  const [loading, setLoading] = useState(true)
  const [subject, setSubject] = useState('')
  const [rawEmail, setRawEmail] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await authFetch('/api/procurement/email-ingestion')
    const json = await res.json()
    if (json.success) setItems(json.data)
  }, [])

  useEffect(() => {
    load().finally(() => setLoading(false))
  }, [load])

  const ingest = async () => {
    setBusy('ingest')
    try {
      await authFetch('/api/procurement/email-ingestion', {
        method: 'POST',
        body: JSON.stringify({
          subject,
          rawEmailText: rawEmail,
          source: 'manual_upload',
        }),
      })
      setSubject('')
      setRawEmail('')
      await load()
    } finally {
      setBusy(null)
    }
  }

  const action = async (id: string, path: string) => {
    setBusy(id + path)
    try {
      await authFetch(`/api/procurement/email-ingestion/${id}/${path}`, { method: 'POST' })
      await load()
    } finally {
      setBusy(null)
    }
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-white p-6">
        <h3 className="font-semibold text-slate-900">Manual RFQ upload</h3>
        <p className="mt-1 text-sm text-slate-600">
          Paste forwarded email content until mailbox webhook for rfq@tenderbriefing.co.za is connected.
        </p>
        <input
          className="mt-3 w-full rounded-lg border px-3 py-2 text-sm"
          placeholder="Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
        <textarea
          className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
          rows={6}
          placeholder="Paste raw email body…"
          value={rawEmail}
          onChange={(e) => setRawEmail(e.target.value)}
        />
        <button
          type="button"
          disabled={busy !== null || !rawEmail.trim()}
          onClick={ingest}
          className="mt-3 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Ingest &amp; extract
        </button>
      </div>

      <div className="rounded-xl border bg-white p-6">
        <h3 className="font-semibold text-slate-900">Ingested RFQs ({items.length})</h3>
        <ul className="mt-4 space-y-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-lg border border-slate-100 p-4 text-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <p className="font-semibold">{item.extraction?.title || item.subject || item.id}</p>
                  <p className="text-slate-500">{item.fromEmail} · SME {item.forwardedByUid?.slice(0, 8)}…</p>
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize">
                  {item.status}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-600">
                Confidence:{' '}
                {item.extraction?.readiness?.confidence != null
                  ? `${Math.round((item.extraction.readiness.confidence || 0) * 100)}%`
                  : '—'}{' '}
                · Dispatch: {item.extraction?.readiness?.dispatchReadiness || '—'}
                {item.duplicateRisk?.duplicate && (
                  <span className="ml-2 text-amber-700">Duplicate risk ({item.duplicateRisk.reason})</span>
                )}
              </p>
              {item.extraction?.readiness?.missingFields?.length ? (
                <p className="mt-1 text-xs text-red-700">
                  Missing: {item.extraction.readiness.missingFields.join(', ')}
                </p>
              ) : null}
              {item.convertedTenderId && (
                <p className="mt-1 text-xs text-brand-700">Converted: {item.convertedTenderId}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => action(item.id, 'extract')}
                  className="rounded border px-2 py-1 text-xs font-semibold"
                >
                  Re-run AI
                </button>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => action(item.id, 'approve')}
                  className="rounded border px-2 py-1 text-xs font-semibold"
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => action(item.id, 'reject')}
                  className="rounded border px-2 py-1 text-xs font-semibold text-red-700"
                >
                  Reject
                </button>
                <button
                  type="button"
                  disabled={busy !== null || item.status === 'converted'}
                  onClick={() => action(item.id, 'convert')}
                  className="rounded bg-brand-600 px-2 py-1 text-xs font-semibold text-white"
                >
                  Convert to private opportunity
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
