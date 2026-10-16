'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ProcurementPageHeader from '@/components/procurement/ProcurementPageHeader'
import { useAuth } from '@/components/providers/AuthProvider'
import { authFetch } from '@/lib/api/authenticatedFetch'

type Delivery = {
  id: string
  status: string
  statusLabel?: string
  reportVersionId?: string
  reportVersion?: number
  to: string[]
  cc: string[]
  subject: string
  body: string
  attachPdf: boolean
  attachDocx: boolean
  attachments?: Array<{ format: string; fileName: string; sha256?: string }>
  providerMessageId?: string | null
  sentAt?: string | null
  failedAt?: string | null
  bouncedAt?: string | null
  failureReason?: string | null
  resendOfDeliveryId?: string | null
}

type Row = {
  id: string
  companyName?: string
  tenderNumber?: string
  tenderDescription?: string
  customerEmail?: string
  opsStage?: string
  opsStageLabel?: string
  opsReportVersion?: number | null
  clientDeliveryStatus?: string | null
}

export default function AdminDeliveryReviewPage() {
  const { user, userProfile, loading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const requestId = String(params?.id || '')

  const [busy, setBusy] = useState(false)
  const [row, setRow] = useState<Row | null>(null)
  const [delivery, setDelivery] = useState<Delivery | null>(null)
  const [history, setHistory] = useState<Delivery[]>([])
  const [confirmOpen, setConfirmOpen] = useState(false)

  const [to, setTo] = useState('')
  const [cc, setCc] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [attachPdf, setAttachPdf] = useState(true)
  const [attachDocx, setAttachDocx] = useState(false)

  const load = useCallback(async () => {
    if (!requestId) return
    const res = await authFetch(`/api/admin/ops/${requestId}/delivery`)
    const json = await res.json()
    if (!json.success) {
      toast.error(json.error || 'Failed to load delivery')
      return
    }
    setRow(json.data.row)
    const d = json.data.delivery as Delivery | null
    setDelivery(d)
    setHistory(json.data.history || [])
    if (d) {
      setTo((d.to || []).join(', '))
      setCc((d.cc || []).join(', '))
      setSubject(d.subject || '')
      setBody(d.body || '')
      setAttachPdf(d.attachPdf !== false)
      setAttachDocx(d.attachDocx === true)
    }
  }, [requestId])

  useEffect(() => {
    if (!loading) {
      if (!user) router.push('/auth/signin')
      else if (userProfile?.userType !== 'admin') router.push('/dashboard')
    }
  }, [user, userProfile, loading, router])

  useEffect(() => {
    if (user && userProfile?.userType === 'admin') load()
  }, [user, userProfile, load])

  async function runAction(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true)
    try {
      const res = await authFetch(`/api/admin/ops/${requestId}/delivery`, {
        method: 'POST',
        body: JSON.stringify({ action, deliveryId: delivery?.id, ...extra }),
      })
      const json = await res.json()
      if (!json.success) {
        toast.error(json.error || 'Action failed')
        return false
      }
      if (action === 'confirm_send') {
        if (json.data?.duplicate) toast.success('Already sent — duplicate blocked')
        else if (json.data?.emailSent) toast.success('Report sent to client')
        else if (json.data?.error) toast.error(json.data.error)
        else toast.success('Delivery updated')
      } else {
        toast.success(`${action.replace(/_/g, ' ')} OK`)
      }
      await load()
      return true
    } catch {
      toast.error('Action failed')
      return false
    } finally {
      setBusy(false)
    }
  }

  async function onOpenReview() {
    await runAction('open')
  }

  async function onSaveDraft(e: FormEvent) {
    e.preventDefault()
    await runAction('update', {
      patch: {
        to,
        cc,
        subject,
        body,
        attachPdf,
        attachDocx,
      },
    })
  }

  const canEdit = useMemo(() => {
    if (!delivery) return false
    return ['delivery_review', 'failed', 'bounced', 'send_pending'].includes(delivery.status)
  }, [delivery])

  const canSend = useMemo(() => {
    if (!delivery || !canEdit) return false
    if (!to.trim()) return false
    if (!attachPdf && !attachDocx) return false
    return true
  }, [delivery, canEdit, to, attachPdf, attachDocx])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <LoadingSpinner size="lg" />
      </div>
    )
  }
  if (!user || userProfile?.userType !== 'admin') return null

  return (
    <div className="procurement-shell">
      <Header />
      <ProcurementPageHeader
        kicker="Operations"
        title="Send report to client"
        description="Review recipients and attachments, then confirm deliberately. Opening this page never sends email."
        breadcrumb={{ label: 'Operations board', href: '/admin/operations' }}
      />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-900">
              {row?.companyName || '—'} · {row?.tenderNumber || '—'}
            </p>
            <p className="text-xs text-slate-500">
              Request {requestId}
              {delivery?.reportVersion != null ? ` · Report v${delivery.reportVersion}` : ''}
              {delivery ? ` · ${delivery.statusLabel || delivery.status}` : ''}
            </p>
            <p className="mt-1 text-sm text-slate-700 line-clamp-2">
              {row?.tenderDescription || '—'}
            </p>
          </div>
          <Link
            href="/admin/operations"
            className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            Back to board
          </Link>
        </div>

        {!delivery ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="text-sm text-slate-600">
              No delivery review yet. This opens a draft only — nothing is emailed.
            </p>
            <button
              type="button"
              disabled={busy}
              className="mt-4 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              onClick={onOpenReview}
            >
              Open delivery review
            </button>
          </div>
        ) : (
          <form onSubmit={onSaveDraft} className="space-y-5">
            <section className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">
                Final recipient
              </p>
              <p className="mt-1 break-all text-lg font-semibold text-slate-900">
                {to.trim() || '— no recipient —'}
              </p>
              {cc.trim() ? (
                <p className="mt-1 text-sm text-slate-700">
                  CC: <span className="font-medium">{cc}</span>
                </p>
              ) : null}
              <p className="mt-2 text-xs text-slate-600">
                Approved report version:{' '}
                <strong>
                  {delivery.reportVersionId} (v{delivery.reportVersion})
                </strong>
              </p>
            </section>

            {delivery.failureReason ? (
              <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">
                {delivery.status === 'bounced' ? 'Bounced' : 'Failed'}: {delivery.failureReason}
              </div>
            ) : null}

            <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <label className="block text-sm">
                Recipient *
                <input
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                  value={to}
                  disabled={!canEdit || busy}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="client@example.com"
                />
              </label>
              <label className="block text-sm">
                CC
                <input
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                  value={cc}
                  disabled={!canEdit || busy}
                  onChange={(e) => setCc(e.target.value)}
                  placeholder="optional@example.com"
                />
              </label>
              <label className="block text-sm">
                Subject
                <input
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                  value={subject}
                  disabled={!canEdit || busy}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                Email body
                <textarea
                  rows={12}
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-sans text-sm"
                  value={body}
                  disabled={!canEdit || busy}
                  onChange={(e) => setBody(e.target.value)}
                />
              </label>

              <div className="flex flex-wrap gap-4 border-t border-slate-100 pt-3 text-sm">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={attachPdf}
                    disabled={!canEdit || busy}
                    onChange={(e) => setAttachPdf(e.target.checked)}
                  />
                  PDF (default)
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={attachDocx}
                    disabled={!canEdit || busy}
                    onChange={(e) => setAttachDocx(e.target.checked)}
                  />
                  DOCX (optional)
                </label>
              </div>

              {canEdit ? (
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg border border-slate-400 px-4 py-2 text-sm font-semibold disabled:opacity-60"
                >
                  Save draft
                </button>
              ) : null}
            </section>

            {canEdit ? (
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <p className="text-sm text-slate-600">
                  Saving a draft never sends. Sending requires the confirmation step below.
                </p>
                <button
                  type="button"
                  disabled={busy || !canSend}
                  className="mt-3 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                  onClick={() => setConfirmOpen(true)}
                >
                  Confirm &amp; send…
                </button>
              </div>
            ) : null}

            {delivery.status === 'sent' || delivery.status === 'delivered' ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
                Sent
                {delivery.sentAt ? ` at ${delivery.sentAt}` : ''}.
                {delivery.providerMessageId
                  ? ` Provider ID: ${delivery.providerMessageId}.`
                  : ''}{' '}
                <button
                  type="button"
                  disabled={busy}
                  className="ml-2 underline"
                  onClick={() => runAction('resend')}
                >
                  Resend report (new attempt)
                </button>
              </div>
            ) : null}

            {(delivery.status === 'failed' || delivery.status === 'bounced') && (
              <button
                type="button"
                disabled={busy}
                className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white"
                onClick={() =>
                  runAction('retry', {
                    newAttempt: delivery.status === 'bounced',
                  })
                }
              >
                {delivery.status === 'bounced' ? 'Fix recipient / resend' : 'Retry send'}
              </button>
            )}
          </form>
        )}

        {history.length > 0 ? (
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
              Delivery history
            </h2>
            <ul className="mt-3 space-y-2 text-sm">
              {history.map((h) => (
                <li key={h.id} className="rounded border border-slate-100 px-3 py-2">
                  <div className="font-medium">
                    {h.statusLabel || h.status} · v{h.reportVersion}
                  </div>
                  <div className="text-xs text-slate-500">
                    {(h.to || []).join(', ')} · {h.id}
                    {h.resendOfDeliveryId ? ` · resend of ${h.resendOfDeliveryId}` : ''}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>

      {confirmOpen && delivery ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">Confirm &amp; send</h3>
            <p className="mt-2 text-sm text-slate-600">
              This emails the exact approved report version to the recipient below. This cannot be
              undone as the same delivery attempt.
            </p>
            <dl className="mt-4 space-y-2 text-sm">
              <div>
                <dt className="text-xs uppercase text-slate-500">Recipient</dt>
                <dd className="break-all font-semibold text-slate-900">{to}</dd>
              </div>
              {cc.trim() ? (
                <div>
                  <dt className="text-xs uppercase text-slate-500">CC</dt>
                  <dd className="break-all">{cc}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-xs uppercase text-slate-500">Subject</dt>
                <dd>{subject}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-slate-500">Attachments</dt>
                <dd>
                  {attachPdf ? 'PDF' : ''}
                  {attachPdf && attachDocx ? ' + ' : ''}
                  {attachDocx ? 'DOCX' : ''}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-slate-500">Report version</dt>
                <dd>
                  {delivery.reportVersionId} (v{delivery.reportVersion})
                </dd>
              </div>
            </dl>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                onClick={() => setConfirmOpen(false)}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                onClick={async () => {
                  // Persist latest edits then confirm
                  await runAction('update', {
                    patch: { to, cc, subject, body, attachPdf, attachDocx },
                  })
                  const ok = await runAction('confirm_send', { confirm: true })
                  if (ok) setConfirmOpen(false)
                }}
              >
                Confirm &amp; send
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <Footer />
    </div>
  )
}
