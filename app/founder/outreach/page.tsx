'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'react-hot-toast'
import { FounderShell } from '@/components/founder/FounderShell'
import { RecipientChipInput } from '@/components/founder/outreach/RecipientChipInput'
import { RichEmailEditor } from '@/components/founder/outreach/RichEmailEditor'
import { authFetch } from '@/lib/api/authenticatedFetch'
import { isFounderSmeOutreachEnabledClient } from '@/lib/founder/outreach/clientFlag'
import type { ComposerTemplateKey } from '@/lib/founder/outreach/composerTemplates'
import {
  OUTREACH_CTA_LABEL,
  OUTREACH_SEND_CONCURRENCY,
  OUTREACH_SEND_TICK_SIZE,
  OUTREACH_SUBJECT,
  YOUTH_AGENT_OUTREACH_CTA_LABEL,
  YOUTH_AGENT_OUTREACH_SUBJECT,
} from '@/lib/founder/outreach/featureFlag'
import { isValidEmailSyntax, parseRecipientFields } from '@/lib/founder/outreach/parseRecipients'
import {
  individualEmailConfirmCopy,
  labelCampaignStatus,
  providerAcceptanceDisclaimer,
  suppressionExclusionCopy,
} from '@/lib/founder/outreach/statusLabels'

type CampaignSummary = {
  id: string
  type?: string
  templateKey?: string | null
  templateVersion?: string
  originalFileName: string
  source?: string
  subject?: string | null
  createdAt: string
  status: string
  sendableRows: number
  sentCount: number
  failedCount: number
  suppressedRows: number
  toCount?: number
  ccCount?: number
  bccCount?: number
  fromAddress?: string | null
}

type SendReport = {
  campaignId: string
  status: string
  submitted: number
  failed: number
  sendableRows: number
  subject?: string
  from?: string
  failures?: Array<{ email: string; errorCode?: string; error?: string }>
}

type ComposePreview = {
  rawRecipients?: number
  duplicatesRemoved?: number
  suppressedRecipients?: string[]
  sendableRecipients: number
  individualEmails: number
  confirmCount: number
  confirmCopy: string
  suppressionCopy?: string | null
  to: number
  cc: number
  bcc: number
  subject: string
  from: string
  requiresLargeConfirm?: boolean
}

const TEMPLATES: Array<{ key: ComposerTemplateKey; label: string; subject: string; html: string }> = [
  { key: 'blank', label: 'Blank Email', subject: '', html: '<p></p>' },
  {
    key: 'sme_invitation',
    label: 'SME Invitation',
    subject: OUTREACH_SUBJECT,
    html: `
      <h2>Compulsory briefings, without the travel</h2>
      <p>Hi there,</p>
      <p>We’d like to invite you to use TenderBriefing to book a Youth Agent to attend a compulsory tender briefing on behalf of your company — anywhere in South Africa.</p>
      <p><strong>With TenderBriefing, you can:</strong></p>
      <ul>
        <li>View available compulsory tender briefings</li>
        <li>Book a Youth Agent to attend on your behalf</li>
        <li>Receive attendance proof</li>
        <li>Get a structured briefing report</li>
      </ul>
      <p><a href="https://www.tenderbriefing.co.za/tenders">${OUTREACH_CTA_LABEL}</a></p>
      <p>TenderBriefing<br/>You run the business. We attend the briefing.</p>
    `.trim(),
  },
  {
    key: 'youth_agent_invitation',
    label: 'Youth Agent Invitation',
    subject: YOUTH_AGENT_OUTREACH_SUBJECT,
    html: `
      <h2>Invitation to become Youth Agents</h2>
      <p>Hi there,</p>
      <p>TenderBriefing is inviting motivated young people to join our Youth Agent network.</p>
      <p><a href="https://www.tenderbriefing.co.za/auth/signup?type=youth-agent">${YOUTH_AGENT_OUTREACH_CTA_LABEL}</a></p>
      <p>TenderBriefing<br/>Connecting SMEs with Youth Agents nationwide.</p>
    `.trim(),
  },
]
const LARGE_CONFIRM = 20

function newIdempotencyKey() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `compose-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export default function FounderOutreachPage() {
  const flagOn = isFounderSmeOutreachEnabledClient()
  const [templateKey, setTemplateKey] = useState<ComposerTemplateKey>('blank')
  const [fromDisplay, setFromDisplay] = useState('TenderBriefing <info@tenderbriefing.co.za>')
  const [senderId, setSenderId] = useState('primary')
  const [to, setTo] = useState<string[]>([])
  const [cc, setCc] = useState<string[]>([])
  const [bcc, setBcc] = useState<string[]>([])
  const [subject, setSubject] = useState('')
  const [html, setHtml] = useState('<p></p>')
  const [busy, setBusy] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [preview, setPreview] = useState<ComposePreview | null>(null)
  const [history, setHistory] = useState<CampaignSummary[]>([])
  const [report, setReport] = useState<SendReport | null>(null)
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey)

  const parsed = useMemo(
    () => parseRecipientFields({ to, cc, bcc }),
    [to, cc, bcc]
  )
  const invalidEmails = parsed.invalid.filter((r) => r.reason === 'invalid_email')
  const subjectLen = subject.trim().length

  const loadHistory = useCallback(async () => {
    if (!flagOn) return
    try {
      const res = await authFetch('/api/founder/outreach/campaigns')
      const json = await res.json()
      if (res.ok && json.success) setHistory(json.data.campaigns || [])
    } catch {
      /* ignore */
    }
  }, [flagOn])

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  useEffect(() => {
    if (!flagOn) return
    void (async () => {
      try {
        const res = await authFetch('/api/founder/outreach/compose')
        const json = await res.json()
        if (res.ok && json.success && json.data?.senders?.[0]) {
          setFromDisplay(json.data.senders[0].display)
          setSenderId(json.data.senders[0].id)
        }
      } catch {
        /* keep default */
      }
    })()
  }, [flagOn])

  function applyTemplate(key: ComposerTemplateKey) {
    const tpl = TEMPLATES.find((t) => t.key === key) || TEMPLATES[0]
    setTemplateKey(tpl.key)
    setSubject(tpl.subject)
    setHtml(tpl.html)
    setReport(null)
    setConfirmOpen(false)
  }

  async function sendConfirmed() {
    if (busy || !preview) return
    setBusy(true)
    try {
      const res = await authFetch('/api/founder/outreach/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          cc,
          bcc,
          subject: subject.trim(),
          html,
          templateKey,
          senderId,
          confirmSend: true,
          authorisedList: true,
          confirmCount: preview.confirmCount,
          idempotencyKey,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        toast.error(json.error || 'Send failed')
        return
      }
      const data = json.data as SendReport & { duplicate?: boolean }
      setReport(data)
      setConfirmOpen(false)
      setPreview(null)
      setIdempotencyKey(newIdempotencyKey())
      toast.success(
        data.duplicate
          ? 'Already submitted (duplicate click protected)'
          : `SUBMITTED ${data.submitted} · FAILED ${data.failed}`
      )
      void loadHistory()
    } catch {
      toast.error('Network error while sending')
    } finally {
      setBusy(false)
    }
  }

  async function onSendClick() {
    if (busy) return
    if (!subject.trim()) {
      toast.error('Subject is required')
      return
    }
    if (parsed.totalSendable === 0) {
      toast.error('Add at least one valid recipient')
      return
    }
    if (invalidEmails.length) {
      toast.error('Remove invalid email addresses before sending')
      return
    }
    if (parsed.exceedsMax) {
      toast.error(`Maximum ${parsed.maxRecipients} recipients`)
      return
    }
    const bodyText = html.replace(/<[^>]+>/g, '').trim()
    if (!bodyText) {
      toast.error('Email body is required')
      return
    }
    setBusy(true)
    try {
      // Server preview applies the same suppression filter as create/send.
      const res = await authFetch('/api/founder/outreach/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          cc,
          bcc,
          subject: subject.trim(),
          html,
          templateKey,
          senderId,
          confirmSend: false,
          authorisedList: false,
        }),
      })
      const json = await res.json()
      const p = json.data?.preview as ComposePreview | undefined
      if (json.code === 'all_suppressed' || (p && p.sendableRecipients === 0)) {
        toast.error(
          p?.suppressionCopy ||
            suppressionExclusionCopy(p?.suppressedRecipients?.length || parsed.totalSendable) ||
            'No sendable recipients after suppression filtering.'
        )
        setPreview(null)
        setConfirmOpen(false)
        return
      }
      if (json.code !== 'confirmation_required' || !p) {
        toast.error(json.error || 'Unable to prepare send confirmation')
        return
      }
      setPreview(p)
      setConfirmOpen(true)
    } catch {
      toast.error('Network error while preparing confirmation')
    } finally {
      setBusy(false)
    }
  }

  if (!flagOn) {
    return (
      <FounderShell title="Outreach" subtitle="Compose and send Founder emails">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          Founder Outreach is disabled. Enable{' '}
          <code className="rounded bg-white px-1">FOUNDER_SME_OUTREACH_ENABLED</code> in the
          runtime environment.
        </div>
      </FounderShell>
    )
  }

  return (
    <FounderShell title="Outreach" subtitle="Compose and send emails to SMEs and Youth Agents">
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-brand-900">Compose Email</h2>
              <p className="mt-1 text-sm text-slate-600">
                Outlook-style composer. Delivery uses production Resend — not Microsoft 365.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {TEMPLATES.map((tpl) => (
                <button
                  key={tpl.key}
                  type="button"
                  onClick={() => applyTemplate(tpl.key)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${
                    templateKey === tpl.key
                      ? 'bg-brand-900 text-white ring-brand-900'
                      : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {tpl.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                From
              </label>
              <select
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-brand-900"
                value={senderId}
                onChange={(e) => setSenderId(e.target.value)}
                disabled
              >
                <option value={senderId}>{fromDisplay}</option>
              </select>
              <p className="mt-1 text-xs text-slate-500">
                Only verified TenderBriefing senders are allowed.
              </p>
            </div>

            <RecipientChipInput
              label="To"
              values={to}
              onChange={setTo}
              reserved={[...cc, ...bcc]}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <RecipientChipInput
                label="Cc"
                values={cc}
                onChange={setCc}
                reserved={[...to, ...bcc]}
              />
              <RecipientChipInput
                label="Bcc"
                values={bcc}
                onChange={setBcc}
                reserved={[...to, ...cc]}
              />
            </div>

            {invalidEmails.length > 0 && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                Invalid addresses:{' '}
                {invalidEmails.map((r) => r.email).join(', ')}
              </div>
            )}

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Subject
                </label>
                <span className="text-xs text-slate-400">{subjectLen} characters</span>
              </div>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={500}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                placeholder="Email subject"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Body
              </label>
              <RichEmailEditor value={html} onChange={setHtml} disabled={busy} />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <p className="text-sm text-slate-600">
                Recipients:{' '}
                <span className="font-semibold text-brand-900">{parsed.totalSendable}</span>
                <span className="ml-2 text-xs text-slate-500">
                  To {parsed.toCount} · Cc {parsed.ccCount} · Bcc {parsed.bccCount}
                </span>
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={onSendClick}
                className="inline-flex items-center justify-center rounded-xl bg-accent-500 px-5 py-2.5 text-sm font-bold text-brand-900 shadow-sm hover:bg-accent-400 disabled:opacity-60"
              >
                {busy ? 'Sending…' : 'Send Email'}
              </button>
            </div>
          </div>
        </section>

        {report && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-bold text-brand-900">Send submission report</h3>
            <p className="mt-1 text-sm text-slate-600">{providerAcceptanceDisclaimer()}</p>
            <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">Campaign</dt>
                <dd className="font-mono text-xs text-brand-900">{report.campaignId}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Campaign status</dt>
                <dd className="font-semibold text-brand-900">
                  {labelCampaignStatus(report.status)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">SUBMITTED (provider accepted)</dt>
                <dd className="font-semibold text-emerald-700">{report.submitted}</dd>
              </div>
              <div>
                <dt className="text-slate-500">FAILED</dt>
                <dd className="font-semibold text-red-700">{report.failed}</dd>
              </div>
            </dl>
            {!!report.failures?.length && (
              <ul className="mt-3 space-y-1 text-xs text-red-800">
                {report.failures.map((f) => (
                  <li key={f.email}>
                    {f.email}: {f.error || f.errorCode || 'failed'}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-bold text-brand-900">Outreach history</h3>
            <button
              type="button"
              onClick={() => void loadHistory()}
              className="text-xs font-semibold text-brand-800 hover:underline"
            >
              Refresh
            </button>
          </div>
          {history.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No campaigns yet.</p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {history.map((c) => (
                <li key={c.id} className="py-3 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-brand-900">
                        {c.subject || c.originalFileName || c.id}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {new Date(c.createdAt).toLocaleString()} · {labelCampaignStatus(c.status)} ·{' '}
                        {c.source || (c.originalFileName === 'composer' ? 'composer' : 'xlsx')}
                        {c.templateKey ? ` · ${c.templateKey}` : ''}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Recipients {c.sendableRows}
                        {typeof c.toCount === 'number'
                          ? ` (To ${c.toCount} · Cc ${c.ccCount || 0} · Bcc ${c.bccCount || 0})`
                          : ''}{' '}
                        · SUBMITTED {c.sentCount} · FAILED {c.failedCount}
                      </p>
                    </div>
                    <Link
                      href={`/founder/outreach?campaign=${encodeURIComponent(c.id)}`}
                      className="text-xs font-semibold text-brand-800 hover:underline"
                      onClick={(e) => {
                        e.preventDefault()
                        toast.success(`Campaign ${c.id}`)
                      }}
                    >
                      {c.id.slice(0, 18)}…
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {confirmOpen && preview && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-brand-900">Final send confirmation</h3>
            <p className="mt-2 text-base font-semibold text-brand-900">
              {preview.confirmCopy || individualEmailConfirmCopy(preview.confirmCount)}
            </p>
            {!!preview.suppressionCopy && (
              <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                {preview.suppressionCopy}
                {preview.suppressedRecipients?.length
                  ? ` Excluded: ${preview.suppressedRecipients.join(', ')}.`
                  : ''}
              </p>
            )}
            {(preview.requiresLargeConfirm || preview.confirmCount >= LARGE_CONFIRM) && (
              <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Large send: messages are queued and submitted in controlled batches (concurrency{' '}
                {OUTREACH_SEND_CONCURRENCY}, tick size {OUTREACH_SEND_TICK_SIZE}) — not blasted
                simultaneously. OUTREACH_MAX_RECIPIENTS=2000 is a ceiling, not a blast size.
              </p>
            )}
            <dl className="mt-4 space-y-1.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">From</dt>
                <dd className="text-right font-medium text-brand-900">
                  {preview.from || fromDisplay}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Individual emails (sendable)</dt>
                <dd className="font-semibold">{preview.confirmCount}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">To / Cc / Bcc</dt>
                <dd>
                  {preview.to} / {preview.cc} / {preview.bcc}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Subject</dt>
                <dd className="max-w-[60%] text-right font-medium text-brand-900">
                  {preview.subject || subject.trim()}
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-slate-500">
              Privacy: each address receives its own Resend message with only that address in{' '}
              <code>to</code>. Cc/Bcc labels are bookkeeping — other recipients are never exposed.
              Provider acceptance is recorded as SUBMITTED, not DELIVERED. Suppression
              cannot be overridden from this screen.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setConfirmOpen(false)
                  setPreview(null)
                }}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy || preview.confirmCount <= 0}
                onClick={() => void sendConfirmed()}
                className="rounded-xl bg-accent-500 px-4 py-2 text-sm font-bold text-brand-900 hover:bg-accent-400 disabled:opacity-60"
              >
                {busy ? 'Sending…' : 'Confirm & Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </FounderShell>
  )
}
