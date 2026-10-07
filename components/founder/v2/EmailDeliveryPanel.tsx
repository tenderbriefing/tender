'use client'

import { useCallback, useEffect, useState } from 'react'
import { authFetch } from '@/lib/api/authenticatedFetch'

type DeliveryItem = {
  id: string
  event: string
  eventType: string | null
  recipient: string | null
  subject: string | null
  createdAt: string | null
  deliveryStatus: string
  providerMessageId: string | null
}

type Health = {
  windowHours: number
  delivered: number
  pending: number
  delayed: number
  failed: number
  total: number
}

type DeliveryPayload = {
  health: Health
  warning: string | null
  items: DeliveryItem[]
}

const STATUS_STYLES: Record<string, string> = {
  accepted: 'bg-sky-50 text-sky-900 border-sky-200',
  sent: 'bg-indigo-50 text-indigo-900 border-indigo-200',
  delivered: 'bg-emerald-50 text-emerald-900 border-emerald-200',
  delayed: 'bg-amber-50 text-amber-950 border-amber-200',
  bounced: 'bg-red-50 text-red-900 border-red-200',
  complained: 'bg-red-50 text-red-900 border-red-200',
  failed: 'bg-red-50 text-red-900 border-red-200',
}

function formatWhen(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('en-ZA', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function statusLabel(status: string) {
  if (!status) return 'Unknown'
  return status.charAt(0).toUpperCase() + status.slice(1)
}

export function EmailDeliveryPanel() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<DeliveryPayload | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await authFetch('/api/founder/email-delivery?limit=20')
      const json = await res.json()
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || `HTTP ${res.status}`)
      }
      setData(json.data as DeliveryPayload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load delivery status')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const health = data?.health

  return (
    <section className="rounded-md border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-brand-900">Founder email delivery</h2>
          <p className="text-xs text-slate-500">
            Operational notifications to info@tenderbriefing.co.za · last 24 hours
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="min-h-[32px] rounded-md border border-slate-200 px-3 text-xs font-semibold text-brand-800 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {data?.warning ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold">Delivery warning</p>
          <p className="mt-1">{data.warning}</p>
        </div>
      ) : null}

      {loading && !data ? (
        <p className="px-4 py-8 text-sm text-slate-500">Loading delivery status…</p>
      ) : error && !data ? (
        <div className="px-4 py-6 text-sm text-red-800">
          <p>{error}</p>
          <button type="button" onClick={() => void load()} className="mt-2 font-semibold underline">
            Retry
          </button>
        </div>
      ) : (
        <>
          {health ? (
            <div className="grid grid-cols-2 gap-2 border-b border-slate-100 px-4 py-3 sm:grid-cols-4">
              {[
                { label: 'Delivered', value: health.delivered },
                { label: 'Pending', value: health.pending },
                { label: 'Delayed', value: health.delayed },
                { label: 'Failed/Bounced', value: health.failed },
              ].map((kpi) => (
                <div key={kpi.label} className="rounded-md bg-slate-50 px-3 py-2">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    {kpi.label}
                  </p>
                  <p className="text-lg font-semibold text-brand-900">{kpi.value}</p>
                </div>
              ))}
            </div>
          ) : null}

          {!data?.items?.length ? (
            <p className="px-4 py-8 text-sm text-slate-500">
              No Founder operational emails with delivery tracking yet. New sends after this release
              will appear here.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">Event</th>
                    <th className="px-4 py-2 font-medium">Recipient</th>
                    <th className="px-4 py-2 font-medium">Subject</th>
                    <th className="px-4 py-2 font-medium">Created</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100">
                      <td className="px-4 py-2.5 font-medium text-brand-900">{row.event}</td>
                      <td className="px-4 py-2.5 text-slate-600">{row.recipient || '—'}</td>
                      <td className="max-w-[280px] truncate px-4 py-2.5 text-slate-700">
                        {row.subject || '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                        {formatWhen(row.createdAt)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-flex rounded border px-2 py-0.5 text-xs font-semibold ${
                            STATUS_STYLES[row.deliveryStatus] ||
                            'border-slate-200 bg-slate-50 text-slate-700'
                          }`}
                        >
                          {statusLabel(row.deliveryStatus)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  )
}
