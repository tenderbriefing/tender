'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { authFetch } from '@/lib/api/authenticatedFetch'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import {
  type OpsLifecycleStage,
  SUGGESTED_AGENT_PAYOUT_CENTS,
} from '@/lib/domain/manualBriefingOps'

type OpsRow = {
  id: string
  companyName: string
  contactPerson?: string
  customerEmail?: string
  tenderNumber: string
  tenderDescription?: string
  sourceKind: 'manual' | 'catalogue'
  briefingDate?: string
  briefingTime?: string
  briefingVenue?: string
  province?: string
  paymentStatus?: string
  opsStage: OpsLifecycleStage | string
  opsStageLabel: string
  representativeName?: string | null
  representativePhone?: string | null
  representativePayoutCents?: number | null
  urgencyFlags?: string[]
  lastOpsUpdate?: string | null
  nextAction?: string
  actionHref?: string | null
  evidenceCount?: number
  reportReadyAt?: string | null
  reportStatus?: string | null
  opsReportId?: string | null
  opsReportVersion?: number | null
  reportFileName?: string | null
  reportDocxFileName?: string | null
  clientDeliveryId?: string | null
  clientDeliveryStatus?: string | null
  clientDeliveryProviderStatus?: string | null
  deliveredAt?: string | null
  completedAt?: string | null
  finalReportVersionId?: string | null
  finalDeliveryId?: string | null
  invoiceNumber?: string | null
  amountCents?: number | null
  slaTrack?: string | null
  exceptionCode?: string | null
  exceptionLabel?: string | null
  overdueLabel?: string | null
  boardFilter?: string | null
}

const BOARD_FILTERS = [
  { value: '', label: 'All active' },
  { value: 'needs_attention', label: 'Needs attention' },
  { value: 'due_soon', label: 'Due soon' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'ready_to_send', label: 'Ready to send' },
  { value: 'delivery_issue', label: 'Delivery issue' },
  { value: 'completed', label: 'Completed' },
] as const

const EXCEPTION_STAGES = new Set([
  'payment_required',
  'assignment_required',
  'briefing_due',
  'evidence_required',
  'report_in_progress',
  'report_ready',
])

function formatPayout(cents?: number | null) {
  if (cents == null) return '—'
  return `R${(cents / 100).toFixed(2)}`
}

export default function OpsLifecycleBoard() {
  const [rows, setRows] = useState<OpsRow[]>([])
  const [exceptions, setExceptions] = useState<OpsRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [boardFilter, setBoardFilter] = useState('')
  const [busy, setBusy] = useState(false)
  const [reopenReason, setReopenReason] = useState('')

  const [assignForm, setAssignForm] = useState({
    representativeName: '',
    representativePhone: '',
    agentPayoutCents: String(SUGGESTED_AGENT_PAYOUT_CENTS),
    internalNotes: '',
  })
  const [deliveryNote, setDeliveryNote] = useState('')
  const [evidenceCategory, setEvidenceCategory] = useState('attendance_proof')

  const load = useCallback(async () => {
    const q = boardFilter ? `&filter=${encodeURIComponent(boardFilter)}` : ''
    const res = await authFetch(`/api/admin/ops/board?limit=200${q}`)
    const json = await res.json()
    if (json.success) {
      setRows(json.data.rows || [])
      setExceptions(json.data.exceptions || [])
    } else toast.error(json.error || 'Failed to load ops board')
  }, [boardFilter])

  useEffect(() => {
    load().finally(() => setLoading(false))
  }, [load])

  const filtered = rows

  const selected = filtered.find((r) => r.id === selectedId) || rows.find((r) => r.id === selectedId)

  async function runAction(id: string, action: string, body: Record<string, unknown> = {}) {
    setBusy(true)
    try {
      const res = await authFetch(`/api/admin/ops/${id}`, {
        method: 'POST',
        body: JSON.stringify({ action, ...body }),
      })
      const json = await res.json()
      if (!json.success) {
        toast.error(json.error || 'Action failed')
        return
      }
      if (action === 'mark_delivered' && json.data?.emailSent === false) {
        toast.success('Marked delivered — no email sent')
      } else {
        toast.success(`${action.replace(/_/g, ' ')} OK`)
      }
      await load()
    } catch {
      toast.error('Action failed')
    } finally {
      setBusy(false)
    }
  }

  async function onAssign(e: FormEvent) {
    e.preventDefault()
    if (!selectedId) return
    await runAction(selectedId, 'assign', {
      representativeName: assignForm.representativeName,
      representativePhone: assignForm.representativePhone,
      agentPayoutCents: Number(assignForm.agentPayoutCents),
      internalNotes: assignForm.internalNotes,
    })
  }

  async function runReportAction(id: string, action: string, body: Record<string, unknown> = {}) {
    setBusy(true)
    try {
      const res = await authFetch(`/api/admin/ops/${id}/report`, {
        method: 'POST',
        body: JSON.stringify({ action, ...body }),
      })
      const json = await res.json()
      if (!json.success) {
        toast.error(json.error || 'Report action failed')
        return
      }
      if (action === 'approve' && json.data?.emailSent === false) {
        toast.success('Report approved — PDF & DOCX ready (no email)')
      } else if (action === 'generate') {
        toast.success('Draft generated — review before approval')
      } else {
        toast.success(`${action.replace(/_/g, ' ')} OK`)
      }
      await load()
    } catch {
      toast.error('Report action failed')
    } finally {
      setBusy(false)
    }
  }

  async function downloadReport(id: string, format: 'pdf' | 'docx') {
    setBusy(true)
    try {
      const res = await authFetch(`/api/admin/ops/${id}/report/download?format=${format}`)
      const ct = res.headers.get('content-type') || ''
      if (ct.includes('application/json')) {
        const json = await res.json()
        if (!json.success) {
          toast.error(json.error || 'Download failed')
          return
        }
        if (json.data?.url) {
          window.open(json.data.url, '_blank', 'noopener,noreferrer')
          return
        }
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = format === 'pdf' ? `report-${id}.pdf` : `report-${id}.docx`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Download failed')
    } finally {
      setBusy(false)
    }
  }

  async function onUploadEvidence(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!selectedId) return
    const formEl = e.currentTarget
    const fileInput = formEl.elements.namedItem('file') as HTMLInputElement
    const file = fileInput?.files?.[0]
    if (!file) {
      toast.error('Choose a file')
      return
    }
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('category', evidenceCategory)
      const res = await authFetch(`/api/admin/ops/${selectedId}/evidence`, {
        method: 'POST',
        body: fd,
      })
      const json = await res.json()
      if (!json.success) {
        toast.error(json.error || 'Upload failed')
        return
      }
      toast.success('Evidence uploaded')
      formEl.reset()
      await load()
    } catch {
      toast.error('Upload failed')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Operations Board</h2>
          <p className="text-sm text-slate-600">
            What needs attention, what is due next, what completed, what failed. No silent
            failures — exceptions link to the required action.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm text-slate-600">
            Focus{' '}
            <select
              className="ml-1 rounded border border-slate-300 px-2 py-1.5 text-sm"
              value={boardFilter}
              onChange={(e) => setBoardFilter(e.target.value)}
            >
              {BOARD_FILTERS.map((f) => (
                <option key={f.value || 'all'} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => load()}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {exceptions.length > 0 && !boardFilter ? (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-4 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-amber-950">
            Exception queue ({exceptions.length})
          </h3>
          <p className="mt-1 text-xs text-amber-900">
            Derived exceptions — what needs human intervention now.
          </p>
          <ul className="mt-3 space-y-2">
            {exceptions.slice(0, 12).map((ex) => (
              <li
                key={ex.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm"
              >
                <button
                  type="button"
                  className="text-left"
                  onClick={() => setSelectedId(ex.id)}
                >
                  <div className="font-medium text-slate-900">
                    {ex.companyName} · {ex.tenderNumber}
                  </div>
                  <div className="text-xs text-amber-900">
                    {ex.exceptionLabel} · {ex.opsStageLabel}
                    {ex.overdueLabel ? ` · overdue ${ex.overdueLabel}` : ''}
                  </div>
                </button>
                {ex.actionHref ? (
                  <a
                    href={ex.actionHref}
                    className="rounded bg-amber-800 px-2.5 py-1 text-xs font-semibold text-white"
                  >
                    {ex.nextAction}
                  </a>
                ) : (
                  <span className="text-xs font-medium text-slate-700">{ex.nextAction}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Client</th>
              <th className="px-3 py-2">Tender / RFQ</th>
              <th className="px-3 py-2">Source</th>
              <th className="px-3 py-2">Briefing</th>
              <th className="px-3 py-2">Payment</th>
              <th className="px-3 py-2">Stage</th>
              <th className="px-3 py-2">Representative</th>
              <th className="px-3 py-2">Payout</th>
              <th className="px-3 py-2">SLA</th>
              <th className="px-3 py-2">Exception</th>
              <th className="px-3 py-2">Next action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-center text-slate-500">
                  No active operations rows.
                </td>
              </tr>
            ) : (
              filtered.map((row) => {
                const isException =
                  EXCEPTION_STAGES.has(String(row.opsStage)) ||
                  Boolean(row.exceptionCode) ||
                  row.slaTrack === 'OVERDUE' ||
                  row.slaTrack === 'BLOCKED'
                return (
                  <tr
                    key={row.id}
                    className={`cursor-pointer border-b border-slate-100 hover:bg-slate-50 ${
                      selectedId === row.id ? 'bg-brand-50/60' : ''
                    }`}
                    onClick={() => setSelectedId(row.id)}
                  >
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-900">{row.companyName || '—'}</div>
                      <div className="text-xs text-slate-500">{row.customerEmail}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{row.tenderNumber || '—'}</div>
                      <div className="line-clamp-2 text-xs text-slate-500">
                        {row.tenderDescription}
                      </div>
                    </td>
                    <td className="px-3 py-2 capitalize">{row.sourceKind}</td>
                    <td className="px-3 py-2">
                      <div>
                        {row.briefingDate || '—'}
                        {row.briefingTime ? ` · ${row.briefingTime}` : ''}
                      </div>
                      <div className="text-xs text-slate-500">{row.briefingVenue || 'Venue TBD'}</div>
                    </td>
                    <td className="px-3 py-2 uppercase">{row.paymentStatus || '—'}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-semibold ${
                          isException
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        {row.opsStageLabel}
                      </span>
                    </td>
                    <td className="px-3 py-2">{row.representativeName || '—'}</td>
                    <td className="px-3 py-2">{formatPayout(row.representativePayoutCents)}</td>
                    <td className="px-3 py-2 text-xs">
                      <span
                        className={`rounded px-1.5 py-0.5 font-semibold ${
                          row.slaTrack === 'BLOCKED'
                            ? 'bg-red-100 text-red-900'
                            : row.slaTrack === 'OVERDUE'
                              ? 'bg-amber-100 text-amber-900'
                              : row.slaTrack === 'DUE_SOON'
                                ? 'bg-yellow-100 text-yellow-900'
                                : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {row.slaTrack || '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-amber-900">
                      {row.exceptionLabel || '—'}
                      {row.overdueLabel ? (
                        <div className="text-slate-500">{row.overdueLabel}</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-700">
                      {row.actionHref ? (
                        <a href={row.actionHref} className="font-medium text-brand-800 underline">
                          {row.nextAction}
                        </a>
                      ) : (
                        row.nextAction
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {selected ? (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                {selected.companyName} · {selected.tenderNumber}
              </h3>
              <p className="text-sm text-slate-600">
                Stage: <strong>{selected.opsStageLabel}</strong> · Next: {selected.nextAction}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Client contact for manual delivery: {selected.customerEmail || '—'}
              </p>
            </div>
            <p className="text-xs text-slate-500">ID {selected.id}</p>
          </div>

          <div className="mt-5 grid gap-6 lg:grid-cols-2">
            <form onSubmit={onAssign} className="space-y-3 rounded-lg border border-slate-200 p-4">
              <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                Assign representative (no account required)
              </h4>
              <label className="block text-sm">
                Name *
                <input
                  required
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                  value={assignForm.representativeName}
                  onChange={(e) =>
                    setAssignForm((f) => ({ ...f, representativeName: e.target.value }))
                  }
                />
              </label>
              <label className="block text-sm">
                Mobile
                <input
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                  value={assignForm.representativePhone}
                  onChange={(e) =>
                    setAssignForm((f) => ({ ...f, representativePhone: e.target.value }))
                  }
                />
              </label>
              <label className="block text-sm">
                Agreed payout (cents, internal only)
                <input
                  type="number"
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                  value={assignForm.agentPayoutCents}
                  onChange={(e) =>
                    setAssignForm((f) => ({ ...f, agentPayoutCents: e.target.value }))
                  }
                />
              </label>
              <label className="block text-sm">
                Internal notes
                <textarea
                  rows={2}
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                  value={assignForm.internalNotes}
                  onChange={(e) =>
                    setAssignForm((f) => ({ ...f, internalNotes: e.target.value }))
                  }
                />
              </label>
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-brand-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                Assign / reassign
              </button>
            </form>

            <div className="space-y-3 rounded-lg border border-slate-200 p-4">
              <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                Lifecycle actions
              </h4>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
                  onClick={() => runAction(selected.id, 'attend')}
                >
                  Mark attended
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
                  onClick={() =>
                    runAction(selected.id, 'evidence_override', {
                      reason: 'admin_override_unusual_briefing',
                    })
                  }
                >
                  Evidence override
                </button>
              </div>

              <div className="space-y-2 border-t border-slate-100 pt-3">
                <h5 className="text-sm font-medium text-slate-800">Client report production</h5>
                <div className="flex flex-wrap gap-2">
                  {(selected.opsStage === 'evidence_received' ||
                    selected.opsStage === 'evidence_required' ||
                    selected.opsStage === 'attended') &&
                  !selected.opsReportId ? (
                    <button
                      type="button"
                      disabled={busy}
                      className="rounded-lg bg-brand-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
                      onClick={() => runReportAction(selected.id, 'generate')}
                    >
                      Generate report
                    </button>
                  ) : null}
                  {selected.opsReportId && selected.opsStage === 'report_in_progress' ? (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
                        onClick={() => runReportAction(selected.id, 'generate')}
                      >
                        Continue / new draft version
                      </button>
                      <a
                        href={`/admin/operations/report/${selected.id}`}
                        className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-semibold text-white"
                      >
                        Review report
                      </a>
                    </>
                  ) : null}
                  {selected.opsStage === 'evidence_received' && selected.opsReportId ? (
                    <a
                      href={`/admin/operations/report/${selected.id}`}
                      className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-semibold text-white"
                    >
                      Review report
                    </a>
                  ) : null}
                  {selected.opsStage === 'report_ready' || selected.reportStatus === 'ready' ? (
                    <>
                      <span className="rounded bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-900">
                        REPORT READY
                      </span>
                      {selected.clientDeliveryStatus === 'delivery_review' ||
                      selected.clientDeliveryStatus === 'failed' ||
                      selected.clientDeliveryStatus === 'bounced' ? (
                        <a
                          href={`/admin/operations/delivery/${selected.id}`}
                          className="rounded-lg bg-brand-700 px-3 py-1.5 text-sm font-semibold text-white"
                        >
                          Continue delivery
                        </a>
                      ) : selected.clientDeliveryStatus === 'sending' ? (
                        <span className="rounded bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-700">
                          SENDING…
                        </span>
                      ) : (
                        <a
                          href={`/admin/operations/delivery/${selected.id}`}
                          className="rounded-lg bg-brand-700 px-3 py-1.5 text-sm font-semibold text-white"
                        >
                          Send to client
                        </a>
                      )}
                      <button
                        type="button"
                        disabled={busy}
                        className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
                        onClick={() => downloadReport(selected.id, 'pdf')}
                      >
                        Download PDF
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
                        onClick={() => downloadReport(selected.id, 'docx')}
                      >
                        Download DOCX
                      </button>
                      <a
                        href={`/admin/operations/report/${selected.id}`}
                        className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
                      >
                        View report
                      </a>
                    </>
                  ) : null}
                  {selected.opsStage === 'delivered' ? (
                    <>
                      <span className="rounded bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-900">
                        DELIVERED
                        {selected.deliveredAt
                          ? ` · ${new Date(selected.deliveredAt).toLocaleString()}`
                          : ''}
                      </span>
                      {selected.clientDeliveryStatus === 'bounced' ? (
                        <a
                          href={`/admin/operations/delivery/${selected.id}`}
                          className="rounded-lg bg-amber-700 px-3 py-1.5 text-sm font-semibold text-white"
                        >
                          Fix recipient / resend
                        </a>
                      ) : (
                        <a
                          href={`/admin/operations/delivery/${selected.id}`}
                          className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
                        >
                          Delivery history / resend
                        </a>
                      )}
                    </>
                  ) : null}
                </div>
                <p className="text-xs text-slate-500">
                  Approval generates PDF + DOCX. Client email only after explicit Confirm &amp; Send.
                </p>
              </div>

              <form onSubmit={onUploadEvidence} className="space-y-2 border-t border-slate-100 pt-3">
                <h5 className="text-sm font-medium text-slate-800">Upload evidence</h5>
                <select
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  value={evidenceCategory}
                  onChange={(e) => setEvidenceCategory(e.target.value)}
                >
                  <option value="attendance_proof">Attendance proof / register</option>
                  <option value="site_photos">Site photos</option>
                  <option value="briefing_photos">Briefing photos</option>
                  <option value="documents">Documents / handouts</option>
                  <option value="notes">Notes</option>
                  <option value="other">Other</option>
                </select>
                <input name="file" type="file" className="block w-full text-sm" />
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  Upload ({selected.evidenceCount || 0} on file)
                </button>
              </form>

              {(selected.opsStage === 'delivered' ||
                selected.opsStage === 'completed' ||
                selected.clientDeliveryStatus) && (
                <div className="space-y-2 border-t border-slate-100 pt-3 text-sm">
                  <h5 className="font-medium text-slate-800">Delivery visibility</h5>
                  <ul className="space-y-1 text-xs text-slate-700">
                    <li>
                      Sent:{' '}
                      {selected.deliveredAt
                        ? new Date(selected.deliveredAt).toLocaleString()
                        : '—'}
                    </li>
                    <li>Provider: Resend</li>
                    <li>
                      Provider state:{' '}
                      {selected.clientDeliveryProviderStatus ||
                        selected.clientDeliveryStatus ||
                        '—'}
                    </li>
                    <li>Recipient: {selected.customerEmail || '—'}</li>
                    <li>
                      Report version:{' '}
                      {selected.finalReportVersionId || selected.opsReportId || '—'}
                      {selected.opsReportVersion != null ? ` (v${selected.opsReportVersion})` : ''}
                    </li>
                    <li>
                      Attachments: PDF
                      {selected.reportDocxFileName ? ' / DOCX' : ''}
                    </li>
                    <li>
                      Completed:{' '}
                      {selected.completedAt
                        ? new Date(selected.completedAt).toLocaleString()
                        : '—'}
                    </li>
                  </ul>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <a
                      href={`/admin/operations/delivery/${selected.id}`}
                      className="rounded border border-slate-300 px-2.5 py-1 text-xs font-semibold hover:bg-slate-50"
                    >
                      View delivery history
                    </a>
                    <button
                      type="button"
                      disabled={busy}
                      className="rounded border border-slate-300 px-2.5 py-1 text-xs font-semibold hover:bg-slate-50"
                      onClick={() => downloadReport(selected.id, 'pdf')}
                    >
                      Download final report
                    </button>
                  </div>
                </div>
              )}

              {selected.opsStage === 'report_ready' || selected.opsStage === 'delivered' ? (
                <div className="space-y-2 border-t border-slate-100 pt-3">
                  <p className="text-sm text-slate-700">
                    Prefer <strong>Send to client</strong> for auditable email delivery. Manual mark
                    remains available if the Founder emailed outside the platform.
                  </p>
                  <textarea
                    rows={2}
                    placeholder="Optional delivery note (manual mark only)"
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    value={deliveryNote}
                    onChange={(e) => setDeliveryNote(e.target.value)}
                  />
                  <button
                    type="button"
                    disabled={busy || selected.opsStage === 'delivered'}
                    className="rounded-lg border border-slate-400 px-3 py-2 text-sm font-semibold disabled:opacity-60"
                    onClick={() =>
                      runAction(selected.id, 'mark_delivered', { deliveryNote })
                    }
                  >
                    Mark as delivered (no email)
                  </button>
                  {selected.opsStage === 'delivered' ? (
                    <button
                      type="button"
                      disabled={busy}
                      className="ml-2 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      onClick={() => runAction(selected.id, 'complete')}
                    >
                      Mark completed
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={busy || selected.opsStage !== 'delivered'}
                    className="ml-2 rounded-lg border border-slate-400 px-3 py-2 text-sm font-semibold disabled:opacity-60"
                    onClick={() => runAction(selected.id, 'close')}
                  >
                    Close
                  </button>
                </div>
              ) : null}

              {selected.opsStage === 'completed' ? (
                <div className="space-y-2 border-t border-slate-100 pt-3">
                  <h5 className="text-sm font-medium text-slate-800">Reopen for correction</h5>
                  <p className="text-xs text-slate-600">
                    Historical delivered report versions stay immutable. Corrections require a new
                    version, approval, and Confirm &amp; Send.
                  </p>
                  <textarea
                    rows={2}
                    required
                    placeholder="Mandatory reopen reason"
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    value={reopenReason}
                    onChange={(e) => setReopenReason(e.target.value)}
                  />
                  <button
                    type="button"
                    disabled={busy || reopenReason.trim().length < 8}
                    className="rounded-lg bg-amber-800 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    onClick={() => {
                      if (
                        !window.confirm(
                          'Reopen this completed fulfilment for correction? Prior delivered versions remain in history.'
                        )
                      ) {
                        return
                      }
                      runAction(selected.id, 'reopen', {
                        confirm: true,
                        reason: reopenReason.trim(),
                      })
                    }}
                  >
                    Reopen for correction
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className="ml-2 rounded-lg border border-slate-400 px-3 py-2 text-sm font-semibold disabled:opacity-60"
                    onClick={() => runAction(selected.id, 'close')}
                  >
                    Close
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  )
}
