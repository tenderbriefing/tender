'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { authFetch } from '@/lib/api/authenticatedFetch'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

type ManualBooking = {
  id: string
  bookingId?: string
  invoiceNumber: string | null
  invoiceStatus: string
  paymentStatus: string
  companyName: string
  customerEmail: string
  tenderReference: string
  tenderDescription?: string
  briefingDate?: string
  briefingTime?: string
  briefingVenue?: string
  amountLabel: string
  paymentUrl: string | null
  createdAt?: string
  paidAt?: string | null
  availableForAssignment?: boolean
  agentName?: string | null
  internalNotes?: string
}

const EMPTY_FORM = {
  companyName: '',
  customerEmail: '',
  tenderReference: '',
  tenderDescription: '',
  briefingDate: '',
  briefingTime: '',
  briefingVenue: '',
  internalNotes: '',
}

export default function ManualPaymentsPanel() {
  const [bookings, setBookings] = useState<ManualBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [lastCreatedUrl, setLastCreatedUrl] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await authFetch('/api/admin/manual-payments')
    const json = await res.json()
    if (json.success) setBookings(json.data.bookings || [])
  }, [])

  useEffect(() => {
    load().finally(() => setLoading(false))
  }, [load])

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    setCreating(true)
    try {
      const res = await authFetch('/api/admin/manual-payments', {
        method: 'POST',
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!json.success) {
        toast.error(json.error || 'Could not create payment request')
        return
      }
      setLastCreatedUrl(json.data.paymentUrl)
      toast.success(`Created ${json.data.invoiceNumber}`)
      setForm(EMPTY_FORM)
      await load()
    } catch {
      toast.error('Could not create payment request')
    } finally {
      setCreating(false)
    }
  }

  async function copyLink(url: string | null) {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Payment link copied')
    } catch {
      toast.error('Could not copy link')
    }
  }

  async function downloadInvoice(id: string, invoiceNumber: string | null) {
    try {
      const res = await authFetch(`/api/admin/manual-payments/${id}/invoice`)
      if (!res.ok) throw new Error('download failed')
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `${invoiceNumber || id}.pdf`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch {
      toast.error('Invoice download failed')
    }
  }

  async function emailCustomer(id: string) {
    try {
      const res = await authFetch(`/api/admin/manual-payments/${id}/email`, {
        method: 'POST',
        body: JSON.stringify({ force: true }),
      })
      const json = await res.json()
      if (!json.success) {
        toast.error(json.error || 'Email failed')
        return
      }
      if (json.data?.email?.sent) toast.success('Invoice emailed to customer')
      else if (json.data?.email?.duplicate) toast.success('Already emailed (idempotent)')
      else toast.error(json.data?.email?.error || 'Email was not sent')
    } catch {
      toast.error('Email failed')
    }
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Create payment request</h2>
        <p className="mt-1 text-sm text-slate-600">
          For emailed RFQs that are not in the tender catalogue. Generates a R750 invoice and secure
          PayFast payment link — no fake tender required.
        </p>

        <form onSubmit={onCreate} className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Customer / company name *</span>
            <input
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              value={form.companyName}
              onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Customer email *</span>
            <input
              required
              type="email"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              value={form.customerEmail}
              onChange={(e) => setForm((f) => ({ ...f, customerEmail: e.target.value }))}
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium text-slate-700">Tender / RFQ reference *</span>
            <input
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              value={form.tenderReference}
              onChange={(e) => setForm((f) => ({ ...f, tenderReference: e.target.value }))}
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium text-slate-700">Tender / RFQ description *</span>
            <textarea
              required
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              value={form.tenderDescription}
              onChange={(e) => setForm((f) => ({ ...f, tenderDescription: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Briefing date</span>
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              value={form.briefingDate}
              onChange={(e) => setForm((f) => ({ ...f, briefingDate: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Briefing time</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              placeholder="e.g. 10:00"
              value={form.briefingTime}
              onChange={(e) => setForm((f) => ({ ...f, briefingTime: e.target.value }))}
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium text-slate-700">Briefing venue</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              value={form.briefingVenue}
              onChange={(e) => setForm((f) => ({ ...f, briefingVenue: e.target.value }))}
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium text-slate-700">Internal notes (admin only)</span>
            <textarea
              rows={2}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              value={form.internalNotes}
              onChange={(e) => setForm((f) => ({ ...f, internalNotes: e.target.value }))}
            />
          </label>

          <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={creating}
              className="rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
            >
              {creating ? 'Creating…' : 'Create R750 invoice + payment link'}
            </button>
            <p className="text-sm text-slate-500">Fixed amount R750.00 · not VAT registered</p>
          </div>
        </form>

        {lastCreatedUrl ? (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm">
            <p className="font-medium text-emerald-900">Payment link ready</p>
            <p className="mt-1 break-all text-emerald-800">{lastCreatedUrl}</p>
            <button
              type="button"
              onClick={() => copyLink(lastCreatedUrl)}
              className="mt-2 text-sm font-semibold text-emerald-900 underline"
            >
              Copy payment link
            </button>
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Manual bookings</h2>
          <button
            type="button"
            onClick={() => load()}
            className="text-sm font-medium text-brand-700 hover:underline"
          >
            Refresh
          </button>
        </div>

        {bookings.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No manual payment requests yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-2 pr-3">Customer</th>
                  <th className="py-2 pr-3">RFQ / tender</th>
                  <th className="py-2 pr-3">Invoice</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Created</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id} className="border-b border-slate-100 align-top">
                    <td className="py-3 pr-3">
                      <div className="font-medium text-slate-900">{b.companyName}</div>
                      <div className="text-slate-500">{b.customerEmail}</div>
                    </td>
                    <td className="py-3 pr-3">
                      <div className="font-medium text-slate-800">{b.tenderReference}</div>
                      {b.briefingDate ? (
                        <div className="text-slate-500">
                          {[b.briefingDate, b.briefingTime].filter(Boolean).join(' · ')}
                        </div>
                      ) : null}
                    </td>
                    <td className="py-3 pr-3">
                      <div>{b.invoiceNumber}</div>
                      <div className="text-slate-500">{b.amountLabel}</div>
                    </td>
                    <td className="py-3 pr-3">
                      <span
                        className={
                          b.paymentStatus === 'paid'
                            ? 'rounded bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800'
                            : 'rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800'
                        }
                      >
                        {b.invoiceStatus || b.paymentStatus}
                      </span>
                      {b.paidAt ? (
                        <div className="mt-1 text-xs text-slate-500">
                          Paid {new Date(b.paidAt).toLocaleString('en-ZA')}
                        </div>
                      ) : null}
                    </td>
                    <td className="py-3 pr-3 text-slate-600">
                      {b.createdAt ? new Date(b.createdAt).toLocaleString('en-ZA') : '—'}
                    </td>
                    <td className="py-3">
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          className="text-left font-medium text-brand-700 hover:underline"
                          onClick={() => copyLink(b.paymentUrl)}
                        >
                          Copy payment link
                        </button>
                        <button
                          type="button"
                          className="text-left text-slate-700 hover:underline"
                          onClick={() => downloadInvoice(b.id, b.invoiceNumber)}
                        >
                          Download invoice
                        </button>
                        <button
                          type="button"
                          className="text-left text-slate-700 hover:underline"
                          onClick={() => emailCustomer(b.id)}
                        >
                          Email invoice / link
                        </button>
                        {b.availableForAssignment ? (
                          <Link
                            href="/admin/dispatch"
                            className="font-medium text-emerald-700 hover:underline"
                          >
                            Assign Youth Agent
                          </Link>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
