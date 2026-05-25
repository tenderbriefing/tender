'use client'

import { useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import { authFetch } from '@/lib/api/authenticatedFetch'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

interface WhatsAppMetrics {
  configured: boolean
  from?: string | null
  sent: number
  failed: number
  pending: number
  total: number
  lastSentAt?: string | null
  latest?: Array<{
    id: string
    type?: string
    status?: string
    recipientRole?: string
    message?: string
    createdAt?: string
    sentAt?: string
    error?: string
  }>
}

export default function TestWhatsAppPanel() {
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState(
    'TenderBriefing test: WhatsApp notifications are configured correctly.'
  )
  const [sending, setSending] = useState(false)
  const [lastSentAt, setLastSentAt] = useState<string | null>(null)
  const [metrics, setMetrics] = useState<WhatsAppMetrics | null>(null)
  const [loadingMetrics, setLoadingMetrics] = useState(true)

  const loadMetrics = () => {
    setLoadingMetrics(true)
    authFetch('/api/admin/whatsapp-metrics')
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setMetrics(j.data)
      })
      .finally(() => setLoadingMetrics(false))
  }

  useEffect(() => {
    loadMetrics()
  }, [])

  const sendTest = async () => {
    if (!phone.trim()) {
      toast.error('Enter a phone number (E.164)')
      return
    }
    setSending(true)
    try {
      const res = await authFetch('/api/notifications/test-whatsapp', {
        method: 'POST',
        body: JSON.stringify({ phone: phone.trim(), message }),
      })
      const json = await res.json()
      if (!json.success) {
        throw new Error(json.error || 'Send failed')
      }
      setLastSentAt(json.data?.sentAt || new Date().toISOString())
      toast.success(
        json.data?.duplicate
          ? 'Duplicate prevented (already sent recently)'
          : 'Test WhatsApp sent'
      )
      loadMetrics()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Test send failed')
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900">Twilio WhatsApp</h2>
      <p className="mt-1 text-sm text-slate-600">
        Sandbox from: <code className="text-xs">whatsapp:+14155238886</code> (join via Twilio
        console). Production uses Secret Manager env vars — never paste secrets here.
      </p>

      {loadingMetrics ? (
        <div className="mt-4 flex justify-center py-6">
          <LoadingSpinner />
        </div>
      ) : metrics ? (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-center">
            <p className="text-xl font-bold text-brand-700">{metrics.sent}</p>
            <p className="text-xs text-slate-600">Sent</p>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-center">
            <p className="text-xl font-bold text-red-700">{metrics.failed}</p>
            <p className="text-xs text-slate-600">Failed</p>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-center">
            <p className="text-xl font-bold text-amber-700">{metrics.pending}</p>
            <p className="text-xs text-slate-600">Pending / skipped</p>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-center">
            <p className="text-xs font-semibold text-slate-700">
              {metrics.configured ? 'Configured' : 'Not configured'}
            </p>
            <p className="text-xs text-slate-500 truncate">{metrics.from || '—'}</p>
          </div>
        </div>
      ) : null}

      <div className="mt-6 space-y-3">
        <label className="block text-sm font-semibold text-slate-700">
          Test phone (E.164)
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+27821234567"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Message
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <button
          type="button"
          onClick={sendTest}
          disabled={sending}
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {sending ? 'Sending…' : 'Send test WhatsApp'}
        </button>
        {lastSentAt && (
          <p className="text-xs text-slate-500">
            Last test sent: {new Date(lastSentAt).toLocaleString()}
          </p>
        )}
      </div>

      {metrics?.latest && metrics.latest.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-bold text-slate-800">Latest delivery log</h3>
          <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto text-xs">
            {metrics.latest.map((row) => (
              <li
                key={row.id}
                className="rounded border border-slate-100 px-2 py-1.5 text-slate-700"
              >
                <span className="font-semibold capitalize">{row.status}</span> · {row.type} ·{' '}
                {row.recipientRole}
                {row.error && (
                  <span className="block text-red-600 truncate">{row.error}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
