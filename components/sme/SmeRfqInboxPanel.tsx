'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { authFetch } from '@/lib/api/authenticatedFetch'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { toast } from 'react-hot-toast'

type IngestedEmail = {
  id: string
  subject?: string
  status?: string
  extraction?: {
    title?: string
    readiness?: {
      confidence?: number
      dispatchEligible?: boolean
      smeActionChecklist?: string[]
      dispatchReadiness?: string
    }
  }
  convertedTenderId?: string
}

export default function SmeRfqInboxPanel() {
  const [items, setItems] = useState<IngestedEmail[]>([])
  const [loading, setLoading] = useState(true)
  const [subject, setSubject] = useState('')
  const [rawEmail, setRawEmail] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const res = await authFetch('/api/procurement/email-ingestion')
    const json = await res.json()
    if (json.success) setItems(json.data)
  }, [])

  useEffect(() => {
    load().finally(() => setLoading(false))
  }, [load])

  const ingest = async () => {
    if (!rawEmail.trim()) {
      toast.error('Paste email content first')
      return
    }
    setBusy(true)
    try {
      const res = await authFetch('/api/procurement/email-ingestion', {
        method: 'POST',
        body: JSON.stringify({
          subject,
          rawEmailText: rawEmail,
          source: 'email_forward',
        }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      toast.success('RFQ ingested — AI extraction complete')
      setSubject('')
      setRawEmail('')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  const run = async (id: string, action: string) => {
    setBusy(true)
    try {
      const res = await authFetch(`/api/procurement/email-ingestion/${id}/${action}`, {
        method: 'POST',
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      toast.success(action === 'convert' ? 'Private opportunity created' : 'Updated')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-brand-200 bg-brand-50/50 p-6">
        <h2 className="text-lg font-bold text-slate-900">Forward RFQs to TenderBriefing</h2>
        <p className="mt-2 text-sm text-slate-700">
          Forward tender invitations, briefing notices, and RFQ emails to{' '}
          <strong>rfq@tenderbriefing.co.za</strong> from your registered company email. Or paste
          the email below as a fallback.
        </p>
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h3 className="font-semibold text-slate-900">Paste / upload RFQ</h3>
        <input
          className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2"
          placeholder="Email subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
        <textarea
          className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          rows={8}
          placeholder="Paste the full forwarded email including briefing date, venue, and reference number…"
          value={rawEmail}
          onChange={(e) => setRawEmail(e.target.value)}
        />
        <button
          type="button"
          disabled={busy}
          onClick={ingest}
          className="mt-3 min-h-[48px] rounded-xl bg-brand-600 px-6 font-semibold text-white disabled:opacity-50"
        >
          {busy ? 'Processing…' : 'Submit for AI extraction'}
        </button>
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h3 className="font-semibold text-slate-900">Your forwarded RFQs</h3>
        {items.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No RFQs yet.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {items.map((item) => (
              <li key={item.id} className="rounded-xl border border-slate-100 p-4">
                <div className="flex justify-between gap-2">
                  <p className="font-semibold text-slate-900">
                    {item.extraction?.title || item.subject}
                  </p>
                  <span className="text-xs font-medium capitalize text-slate-500">{item.status}</span>
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  AI confidence:{' '}
                  {item.extraction?.readiness?.confidence != null
                    ? `${Math.round((item.extraction.readiness.confidence || 0) * 100)}%`
                    : '—'}{' '}
                  · {item.extraction?.readiness?.dispatchReadiness || 'pending'}
                </p>
                {item.extraction?.readiness?.smeActionChecklist && (
                  <ul className="mt-2 list-inside list-disc text-xs text-slate-600">
                    {item.extraction.readiness.smeActionChecklist.slice(0, 4).map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.status === 'pending_review' && (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => run(item.id, 'approve')}
                        className="rounded-lg border px-3 py-1.5 text-sm font-semibold"
                      >
                        Approve extraction
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => run(item.id, 'reject')}
                        className="rounded-lg border px-3 py-1.5 text-sm font-semibold text-red-700"
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {item.status === 'approved' && !item.convertedTenderId && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => run(item.id, 'convert')}
                        className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white"
                      >
                        Create private opportunity
                      </button>
                    )}
                  {item.convertedTenderId && (
                    <Link
                      href={`/tenders/${item.convertedTenderId}/request-agent`}
                      className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
                    >
                      Request youth agent
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
