'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import WorkspaceShell from '@/components/agent/workspace/WorkspaceShell'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { workspaceGet, workspaceMutate } from '@/lib/agent/workspace/clientApi'
import { authFetch } from '@/lib/api/authenticatedFetch'
import { toast } from 'react-hot-toast'

type Detail = {
  request: Record<string, unknown>
  tender: Record<string, unknown>
  aiSummary: Record<string, unknown> | null
  fieldReportDraft: Record<string, unknown> | null
  messages: Array<Record<string, unknown>>
  auditEvents: Array<Record<string, unknown>>
  allowedTransitions: string[]
}

export default function AssignmentDetailPage() {
  const params = useParams()
  const requestId = String(params.requestId || '')
  const [detail, setDetail] = useState<Detail | null>(null)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    const data = await workspaceGet<Detail>(`/api/agent/workspace/assignments/${requestId}`)
    setDetail(data)
    setNotes(String(data.fieldReportDraft?.notes || ''))
  }, [requestId])

  useEffect(() => {
    void load().catch((e) => toast.error(e.message))
  }, [load])

  // Draft autosave
  useEffect(() => {
    if (!detail) return
    const status = String(detail.fieldReportDraft?.status || 'draft')
    if (status === 'locked' || status === 'verified' || status === 'submitted') return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      setSaving(true)
      workspaceMutate('/api/agent/workspace/report', 'PUT', { requestId, notes })
        .then(() => setSaving(false))
        .catch(() => setSaving(false))
    }, 1200)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [notes, requestId, detail])

  async function transition(toStatus: string) {
    try {
      await workspaceMutate(`/api/agent/workspace/assignments/${requestId}`, 'PATCH', {
        toStatus,
      })
      toast.success(`Moved to ${toStatus}`)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Transition failed')
    }
  }

  async function submitReport() {
    try {
      await workspaceMutate('/api/agent/workspace/report', 'PUT', { requestId, notes })
      await workspaceMutate('/api/agent/workspace/report', 'POST', { requestId })
      toast.success('Report submitted and locked')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Submit failed')
    }
  }

  async function uploadEvidence(file: File) {
    const form = new FormData()
    form.append('file', file)
    form.append('requestId', requestId)
    const res = await authFetch('/api/agent/workspace/evidence', { method: 'POST', body: form })
    const json = await res.json()
    if (!res.ok || !json.success) {
      toast.error(json.error || 'Upload failed')
      return
    }
    const url = json.data.url as string
    const photos = [
      ...((detail?.fieldReportDraft?.photoUrls as string[]) || []),
      url,
    ]
    await workspaceMutate('/api/agent/workspace/report', 'PUT', {
      requestId,
      notes,
      photoUrls: photos,
      attendanceProofUrl: url,
    })
    toast.success('Evidence uploaded')
    await load()
  }

  async function sendMessage() {
    if (!msg.trim()) return
    try {
      await workspaceMutate('/api/agent/workspace/messages', 'POST', {
        requestId,
        body: msg,
      })
      setMsg('')
      toast.success('Message sent')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Send failed')
    }
  }

  if (!detail) {
    return (
      <WorkspaceShell title="Assignment">
        <div className="flex justify-center py-16">
          <LoadingSpinner />
        </div>
      </WorkspaceShell>
    )
  }

  const req = detail.request
  const draftStatus = String(detail.fieldReportDraft?.status || 'draft')
  const editable = draftStatus === 'draft' || draftStatus === 'rejected' || !detail.fieldReportDraft
  const evidenceCtaAllowed =
    editable && ['arrived', 'in_progress', 'completed'].includes(String(req.status || ''))

  return (
    <WorkspaceShell title="Assignment">
      <div className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-brand-600">
            {String(req.status || '')}
          </p>
          <h2 className="mt-1 text-lg font-bold text-slate-900">
            {String(detail.tender.tenderNumber || req.tenderNumber || requestId)}
          </h2>
          <p className="text-sm text-slate-600">
            {String(detail.tender.title || req.tenderTitle || '')}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            {String(req.briefingVenue || '')} · {String(req.briefingDate || '')}{' '}
            {String(req.briefingTime || '')}
          </p>
        </section>

        {detail.aiSummary && (
          <section className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4">
            <h3 className="text-sm font-bold text-slate-900">Tender insight</h3>
            <p className="mt-1 text-sm text-slate-700">
              {String(
                (detail.aiSummary as { summary?: string }).summary ||
                  (detail.aiSummary as { overview?: string }).overview ||
                  'Insight available from existing AI service (not generated here).'
              )}
            </p>
          </section>
        )}

        <section>
          <h3 className="mb-2 text-sm font-bold text-slate-700">Advance status</h3>
          <div className="flex flex-wrap gap-2">
            {detail.allowedTransitions.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => void transition(t)}
                className="min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800"
              >
                {t}
              </button>
            ))}
            {detail.allowedTransitions.length === 0 && (
              <p className="text-sm text-slate-500">No agent transitions available.</p>
            )}
          </div>
        </section>

        {evidenceCtaAllowed && (
          <section className="rounded-2xl border border-brand-200 bg-brand-50/20 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">
                  Submit Report
                </p>
                <h3 className="mt-1 text-sm font-bold text-slate-900">Upload audio + attendance proof</h3>
                <p className="mt-1 text-xs text-slate-600">
                  Only audio recording and attendance proof are required.
                </p>
              </div>
              <Link
                href={`/agent/workspace/assignments/${requestId}/submit-evidence`}
                className="min-h-[44px] inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
              >
                Submit Report
              </Link>
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Field report</h3>
            <span className="text-xs text-slate-500">
              {draftStatus}
              {saving ? ' · saving…' : ''}
            </span>
          </div>
          <textarea
            className="mt-2 min-h-[120px] w-full rounded-lg border border-slate-200 p-3 text-sm"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={!editable}
            placeholder="Draft notes autosave…"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <label className="inline-flex min-h-[40px] cursor-pointer items-center rounded-lg bg-slate-100 px-3 text-sm font-semibold">
              Upload evidence
              <input
                type="file"
                className="hidden"
                accept="image/*,application/pdf,audio/*"
                disabled={!editable}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void uploadEvidence(f)
                }}
              />
            </label>
            {editable && (
              <button
                type="button"
                onClick={() => void submitReport()}
                className="min-h-[40px] rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white"
              >
                Submit & lock
              </button>
            )}
          </div>
          {Array.isArray(detail.fieldReportDraft?.photoUrls) &&
            (detail.fieldReportDraft!.photoUrls as string[]).length > 0 && (
              <p className="mt-2 text-xs text-slate-500">
                {(detail.fieldReportDraft!.photoUrls as string[]).length} evidence file(s)
              </p>
            )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-bold text-slate-900">Messages</h3>
          <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto">
            {(detail.messages || []).map((m) => (
              <li key={String(m.id)} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <p className="text-[11px] text-slate-500">
                  {String(m.senderRole)} · {String(m.createdAt || '').slice(0, 16)}
                </p>
                <p>{String(m.body)}</p>
              </li>
            ))}
            {detail.messages?.length === 0 && (
              <li className="text-sm text-slate-500">No messages yet.</li>
            )}
          </ul>
          <div className="mt-3 flex gap-2">
            <input
              className="min-h-[40px] flex-1 rounded-lg border border-slate-200 px-3 text-sm"
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              placeholder="Message SME…"
            />
            <button
              type="button"
              onClick={() => void sendMessage()}
              className="min-h-[40px] rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white"
            >
              Send
            </button>
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-bold text-slate-700">Audit trail</h3>
          <ul className="space-y-1 text-xs text-slate-600">
            {(detail.auditEvents || []).slice(0, 12).map((e) => (
              <li key={String(e.id)}>
                {String(e.type)} · {String(e.createdAt || '').slice(0, 19)}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </WorkspaceShell>
  )
}
