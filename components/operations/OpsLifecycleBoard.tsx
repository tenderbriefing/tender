'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { authFetch } from '@/lib/api/authenticatedFetch'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import {
  OPS_LIFECYCLE_LABELS,
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
  evidenceCount?: number
  reportReadyAt?: string | null
  deliveredAt?: string | null
  invoiceNumber?: string | null
  amountCents?: number | null
}

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
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [stageFilter, setStageFilter] = useState('')
  const [busy, setBusy] = useState(false)

  const [assignForm, setAssignForm] = useState({
    representativeName: '',
    representativePhone: '',
    agentPayoutCents: String(SUGGESTED_AGENT_PAYOUT_CENTS),
    internalNotes: '',
  })
  const [deliveryNote, setDeliveryNote] = useState('')
  const [evidenceCategory, setEvidenceCategory] = useState('attendance_proof')

  const load = useCallback(async () => {
    const res = await authFetch('/api/admin/ops/board?limit=200')
    const json = await res.json()
    if (json.success) setRows(json.data.rows || [])
    else toast.error(json.error || 'Failed to load ops board')
  }, [])

  useEffect(() => {
    load().finally(() => setLoading(false))
  }, [load])

  const filtered = useMemo(() => {
    if (!stageFilter) return rows
    return rows.filter((r) => r.opsStage === stageFilter)
  }, [rows, stageFilter])

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
            Payment through report delivery. Representatives are assigned manually — no Youth
            Agent account required. Delivery email is sent by the Founder outside the platform.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600">
            Stage{' '}
            <select
              className="ml-1 rounded border border-slate-300 px-2 py-1.5 text-sm"
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
            >
              <option value="">All active</option>
              {Object.entries(OPS_LIFECYCLE_LABELS)
                .filter(([k]) => k !== 'closed')
                .map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
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
              <th className="px-3 py-2">Urgency</th>
              <th className="px-3 py-2">Next action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-slate-500">
                  No active operations rows.
                </td>
              </tr>
            ) : (
              filtered.map((row) => {
                const isException = EXCEPTION_STAGES.has(String(row.opsStage))
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
                    <td className="px-3 py-2 text-xs text-amber-800">
                      {(row.urgencyFlags || [])
                        .filter((f) =>
                          [
                            'payment_required',
                            'assignment_required',
                            'briefing_due',
                            'evidence_required',
                            'report_required',
                            'report_ready',
                          ].includes(f)
                        )
                        .map((f) => f.replace(/_/g, ' '))
                        .join(' · ') || '—'}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-700">{row.nextAction}</td>
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
                <button
                  type="button"
                  disabled={busy}
                  className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
                  onClick={() => runAction(selected.id, 'report_in_progress')}
                >
                  Report in progress
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
                  onClick={() => runAction(selected.id, 'report_ready')}
                >
                  Report ready
                </button>
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

              {selected.opsStage === 'report_ready' || selected.opsStage === 'delivered' ? (
                <div className="space-y-2 border-t border-slate-100 pt-3">
                  <p className="text-sm text-slate-700">
                    Email the report to <strong>{selected.customerEmail || 'the client'}</strong>{' '}
                    outside TenderBriefing, then mark delivered.
                  </p>
                  <textarea
                    rows={2}
                    placeholder="Optional delivery note"
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    value={deliveryNote}
                    onChange={(e) => setDeliveryNote(e.target.value)}
                  />
                  <button
                    type="button"
                    disabled={busy || selected.opsStage === 'delivered'}
                    className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    onClick={() =>
                      runAction(selected.id, 'mark_delivered', { deliveryNote })
                    }
                  >
                    Mark as delivered (no email)
                  </button>
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
            </div>
          </div>
        </section>
      ) : null}
    </div>
  )
}
