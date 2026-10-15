'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { authFetch } from '@/lib/api/authenticatedFetch'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { BRIEFING_PRICE_CENTS, formatBriefingPriceZar } from '@/lib/domain/briefingPricing'

type BriefingLineAdmin = {
  id?: string
  lineNumber: number
  tenderNumber: string
  tenderDescription: string
  procuringEntity?: string
  briefingDate?: string
  briefingTime?: string
  briefingVenue?: string
  notes?: string
  unitPriceCents?: number
  paymentAuthorized?: boolean
  fulfilmentStatus?: string
  agentId?: string | null
  agentName?: string | null
  attended?: boolean
  completed?: boolean
}

type ManualBooking = {
  id: string
  bookingId?: string
  invoiceNumber: string | null
  invoiceStatus: string
  paymentStatus: string
  companyName: string
  contactPerson?: string
  customerEmail: string
  customerPhone?: string
  tenderReference: string
  tenderDescription?: string
  briefingDate?: string
  briefingTime?: string
  briefingVenue?: string
  briefingCount?: number
  amountLabel: string
  amountCents?: number
  paymentUrl: string | null
  createdAt?: string
  paidAt?: string | null
  availableForAssignment?: boolean
  agentName?: string | null
  internalNotes?: string
  briefingLines?: Array<{
    lineNumber: number
    tenderNumber: string
    tenderDescription: string
    briefingDate?: string
  }>
  briefingLinesAdmin?: BriefingLineAdmin[]
}

type BriefingFormLine = {
  key: string
  tenderNumber: string
  tenderDescription: string
  procuringEntity: string
  briefingDate: string
  briefingTime: string
  briefingVenue: string
  notes: string
}

const EMPTY_CUSTOMER = {
  companyName: '',
  contactPerson: '',
  customerEmail: '',
  customerPhone: '',
}

function newBriefingLine(): BriefingFormLine {
  return {
    key: `bl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tenderNumber: '',
    tenderDescription: '',
    procuringEntity: '',
    briefingDate: '',
    briefingTime: '',
    briefingVenue: '',
    notes: '',
  }
}

export default function ManualPaymentsPanel() {
  const [bookings, setBookings] = useState<ManualBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [customer, setCustomer] = useState(EMPTY_CUSTOMER)
  const [briefings, setBriefings] = useState<BriefingFormLine[]>([newBriefingLine()])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [lastCreatedUrl, setLastCreatedUrl] = useState<string | null>(null)
  const [lastCreatedInvoice, setLastCreatedInvoice] = useState<string | null>(null)

  const briefingCount = briefings.length
  const displayTotalCents = briefingCount * BRIEFING_PRICE_CENTS
  const orderSummary = useMemo(
    () => ({
      count: briefingCount,
      unitLabel: formatBriefingPriceZar(BRIEFING_PRICE_CENTS),
      totalLabel: formatBriefingPriceZar(displayTotalCents),
    }),
    [briefingCount, displayTotalCents]
  )

  const load = useCallback(async () => {
    const res = await authFetch('/api/admin/manual-payments')
    const json = await res.json()
    if (json.success) setBookings(json.data.bookings || [])
  }, [])

  useEffect(() => {
    load().finally(() => setLoading(false))
  }, [load])

  function updateBriefing(index: number, patch: Partial<BriefingFormLine>) {
    setBriefings((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row))
    )
  }

  function addBriefing() {
    setBriefings((rows) => [...rows, newBriefingLine()])
  }

  function removeBriefing(index: number) {
    setBriefings((rows) => (rows.length <= 1 ? rows : rows.filter((_, i) => i !== index)))
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    setCreating(true)
    try {
      const res = await authFetch('/api/admin/manual-payments', {
        method: 'POST',
        body: JSON.stringify({
          companyName: customer.companyName,
          contactPerson: customer.contactPerson,
          customerEmail: customer.customerEmail,
          customerPhone: customer.customerPhone,
          // Server ignores any client totals — only briefing content is authoritative input.
          briefings: briefings.map((b) => ({
            tenderNumber: b.tenderNumber,
            tenderDescription: b.tenderDescription,
            procuringEntity: b.procuringEntity,
            briefingDate: b.briefingDate,
            briefingTime: b.briefingTime,
            briefingVenue: b.briefingVenue,
            notes: b.notes,
          })),
        }),
      })
      const json = await res.json()
      if (!json.success) {
        toast.error(json.error || 'Could not create payment request')
        return
      }
      setLastCreatedUrl(json.data.paymentUrl)
      setLastCreatedInvoice(json.data.invoiceNumber)
      toast.success(
        `Created ${json.data.invoiceNumber} · ${json.data.booking?.briefingCount || briefingCount} briefing(s)`
      )
      setCustomer(EMPTY_CUSTOMER)
      setBriefings([newBriefingLine()])
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
          For emailed RFQs that are not in the tender catalogue. One customer invoice can cover
          multiple briefings — total is always calculated server-side at R750.00 each.
        </p>

        <form onSubmit={onCreate} className="mt-6 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Company name *</span>
              <input
                required
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                value={customer.companyName}
                onChange={(e) =>
                  setCustomer((c) => ({ ...c, companyName: e.target.value }))
                }
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Contact person</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                value={customer.contactPerson}
                onChange={(e) =>
                  setCustomer((c) => ({ ...c, contactPerson: e.target.value }))
                }
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Customer email *</span>
              <input
                required
                type="email"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                value={customer.customerEmail}
                onChange={(e) =>
                  setCustomer((c) => ({ ...c, customerEmail: e.target.value }))
                }
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Phone number</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                value={customer.customerPhone}
                onChange={(e) =>
                  setCustomer((c) => ({ ...c, customerPhone: e.target.value }))
                }
              />
            </label>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                Briefings requested
              </h3>
              <p className="text-xs text-slate-500">No maximum — add as many as needed</p>
            </div>

            <div className="mt-4 space-y-4">
              {briefings.map((b, index) => (
                <div
                  key={b.key}
                  className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">
                      Briefing #{index + 1}
                    </p>
                    {briefings.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeBriefing(index)}
                        className="text-sm font-medium text-red-700 hover:underline"
                      >
                        Remove briefing
                      </button>
                    ) : null}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-sm sm:col-span-2">
                      <span className="font-medium text-slate-700">
                        Tender / RFQ number *
                      </span>
                      <input
                        required
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                        value={b.tenderNumber}
                        onChange={(e) =>
                          updateBriefing(index, { tenderNumber: e.target.value })
                        }
                      />
                    </label>
                    <label className="block text-sm sm:col-span-2">
                      <span className="font-medium text-slate-700">
                        Tender / RFQ description *
                      </span>
                      <textarea
                        required
                        rows={2}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                        value={b.tenderDescription}
                        onChange={(e) =>
                          updateBriefing(index, { tenderDescription: e.target.value })
                        }
                      />
                    </label>
                    <label className="block text-sm sm:col-span-2">
                      <span className="font-medium text-slate-700">Procuring entity</span>
                      <input
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                        value={b.procuringEntity}
                        onChange={(e) =>
                          updateBriefing(index, { procuringEntity: e.target.value })
                        }
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="font-medium text-slate-700">Briefing date</span>
                      <input
                        type="date"
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                        value={b.briefingDate}
                        onChange={(e) =>
                          updateBriefing(index, { briefingDate: e.target.value })
                        }
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="font-medium text-slate-700">Briefing time</span>
                      <input
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                        placeholder="e.g. 10:00"
                        value={b.briefingTime}
                        onChange={(e) =>
                          updateBriefing(index, { briefingTime: e.target.value })
                        }
                      />
                    </label>
                    <label className="block text-sm sm:col-span-2">
                      <span className="font-medium text-slate-700">Briefing venue</span>
                      <input
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                        value={b.briefingVenue}
                        onChange={(e) =>
                          updateBriefing(index, { briefingVenue: e.target.value })
                        }
                      />
                    </label>
                    <label className="block text-sm sm:col-span-2">
                      <span className="font-medium text-slate-700">Internal notes</span>
                      <textarea
                        rows={2}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                        value={b.notes}
                        onChange={(e) => updateBriefing(index, { notes: e.target.value })}
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addBriefing}
              className="mt-4 w-full rounded-lg border-2 border-dashed border-brand-400 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800 hover:bg-brand-100"
            >
              + Add another briefing
            </button>
          </div>

          <div className="sticky bottom-4 z-10 rounded-xl border border-brand-200 bg-brand-50 p-4 shadow-md sm:static sm:shadow-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-brand-800">
              Order summary
            </h3>
            <dl className="mt-2 grid gap-1 text-sm text-slate-800 sm:grid-cols-3">
              <div>
                <dt className="text-slate-500">Briefings</dt>
                <dd className="text-lg font-semibold">{orderSummary.count}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Price per briefing</dt>
                <dd className="text-lg font-semibold">{orderSummary.unitLabel}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Total due</dt>
                <dd className="text-lg font-bold text-brand-900">{orderSummary.totalLabel}</dd>
              </div>
            </dl>
            <p className="mt-2 text-xs text-slate-500">
              Display only — the server recalculates {orderSummary.count} × R750.00 before
              creating the payment request. There is no editable total field.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={creating}
              className="rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
            >
              {creating
                ? 'Creating…'
                : `Create invoice + payment link (${orderSummary.totalLabel})`}
            </button>
            <p className="text-sm text-slate-500">Not VAT registered · one PayFast transaction</p>
          </div>
        </form>

        {lastCreatedUrl ? (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm">
            <p className="font-medium text-emerald-900">
              Payment link ready{lastCreatedInvoice ? ` · ${lastCreatedInvoice}` : ''}
            </p>
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
                  <th className="py-2 pr-3">Briefings</th>
                  <th className="py-2 pr-3">Invoice</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Created</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => {
                  const count = b.briefingCount || b.briefingLinesAdmin?.length || 1
                  const lines = b.briefingLinesAdmin || b.briefingLines || []
                  const expanded = expandedId === b.id
                  return (
                    <tr key={b.id} className="border-b border-slate-100 align-top">
                      <td className="py-3 pr-3">
                        <div className="font-medium text-slate-900">{b.companyName}</div>
                        {b.contactPerson ? (
                          <div className="text-slate-500">{b.contactPerson}</div>
                        ) : null}
                        <div className="text-slate-500">{b.customerEmail}</div>
                      </td>
                      <td className="py-3 pr-3">
                        <button
                          type="button"
                          className="font-medium text-brand-700 hover:underline"
                          onClick={() => setExpandedId(expanded ? null : b.id)}
                        >
                          {count} briefing{count === 1 ? '' : 's'}
                        </button>
                        {!expanded && b.tenderReference ? (
                          <div className="mt-0.5 text-slate-500">{b.tenderReference}</div>
                        ) : null}
                        {expanded ? (
                          <ul className="mt-2 space-y-2 text-xs text-slate-700">
                            {lines.length > 0
                              ? lines.map((line) => (
                                  <li
                                    key={`${b.id}-${line.lineNumber}-${line.tenderNumber}`}
                                    className="rounded border border-slate-100 bg-slate-50 p-2"
                                  >
                                    <div className="font-semibold">
                                      {line.lineNumber}. {line.tenderNumber}
                                    </div>
                                    <div className="text-slate-600">
                                      {line.tenderDescription}
                                    </div>
                                    {'fulfilmentStatus' in line && line.fulfilmentStatus ? (
                                      <div className="mt-1 text-slate-500">
                                        Agent:{' '}
                                        {(line as BriefingLineAdmin).agentName || 'Unassigned'}
                                        {' · '}
                                        {b.paymentStatus === 'paid'
                                          ? 'PAID / '
                                          : ''}
                                        {String(
                                          (line as BriefingLineAdmin).fulfilmentStatus
                                        )
                                          .replace(/_/g, ' ')
                                          .toUpperCase()}
                                      </div>
                                    ) : null}
                                  </li>
                                ))
                              : (
                                  <li className="text-slate-500">{b.tenderReference}</li>
                                )}
                          </ul>
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
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
