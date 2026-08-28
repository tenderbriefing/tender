'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'react-hot-toast'
import { FounderShell } from '@/components/founder/FounderShell'
import { authFetch } from '@/lib/api/authenticatedFetch'
import { isFounderSmeOutreachEnabledClient } from '@/lib/founder/outreach/clientFlag'

type OutreachCampaignType = 'sme_invitation' | 'youth_agent_invitation'

type CampaignSummary = {
  id: string
  type?: OutreachCampaignType
  templateVersion?: string
  originalFileName: string
  createdAt: string
  status: string
  sendableRows: number
  sentCount: number
  failedCount: number
  suppressedRows: number
}

type PreviewRow = {
  name: string
  companyName: string
  email: string
  status: string
  reason?: string | null
  rowNumber?: number
}

type ValidateData = {
  campaign: {
    id: string
    type: OutreachCampaignType
    originalFileName: string
    totalRows: number
    validRows: number
    invalidRows: number
    duplicateRows: number
    suppressedRows: number
    sendableRows: number
    status: string
  }
  preview: PreviewRow[]
  emailPreview: {
    subject: string
    ctaLabel: string
    ctaUrl: string
    templateVersion: string
    textExcerpt: string
    campaignType: OutreachCampaignType
    audienceLabel: string
  }
}

const AUDIENCE_OPTIONS: {
  type: OutreachCampaignType
  label: string
  description: string
  columns: string
}[] = [
  {
    type: 'sme_invitation',
    label: 'SME Invitation',
    description: 'Invite businesses to book Youth Agents for compulsory briefings.',
    columns: 'Name, Company Name, Email',
  },
  {
    type: 'youth_agent_invitation',
    label: 'Youth Agent Invitation',
    description: 'Recruit prospective Youth Agents to join TenderBriefing.',
    columns: 'Name, Email (Company Name optional)',
  },
]

function audienceLabel(type?: OutreachCampaignType): string {
  if (type === 'youth_agent_invitation') return 'Youth Agent Invitation'
  return 'SME Invitation'
}

export default function FounderOutreachPage() {
  const flagOn = isFounderSmeOutreachEnabledClient()
  const [campaignType, setCampaignType] = useState<OutreachCampaignType>('sme_invitation')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [sending, setSending] = useState(false)
  const [validated, setValidated] = useState<ValidateData | null>(null)
  const [confirmSend, setConfirmSend] = useState(false)
  const [authorisedList, setAuthorisedList] = useState(false)
  const [history, setHistory] = useState<CampaignSummary[]>([])
  const [activeResult, setActiveResult] = useState<any>(null)

  const selectedAudience = AUDIENCE_OPTIONS.find((o) => o.type === campaignType)!
  const isYouth = campaignType === 'youth_agent_invitation'

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

  function onAudienceChange(type: OutreachCampaignType) {
    setCampaignType(type)
    setValidated(null)
    setActiveResult(null)
    setConfirmSend(false)
    setAuthorisedList(false)
    setFile(null)
  }

  if (!flagOn) {
    return (
      <FounderShell title="Outreach" subtitle="Invitations">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          Founder Outreach is disabled in this environment (
          <code className="font-mono text-xs">FOUNDER_SME_OUTREACH_ENABLED</code>).
        </div>
      </FounderShell>
    )
  }

  async function onValidate(e: React.FormEvent) {
    e.preventDefault()
    if (!file || busy) return
    setBusy(true)
    setValidated(null)
    setActiveResult(null)
    setConfirmSend(false)
    setAuthorisedList(false)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('campaignType', campaignType)
      const res = await authFetch('/api/founder/outreach/validate', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Validation failed')
      setValidated(json.data as ValidateData)
      toast.success('Workbook validated')
      await loadHistory()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Validation failed')
    } finally {
      setBusy(false)
    }
  }

  async function onSend(e: React.FormEvent) {
    e.preventDefault()
    if (!validated || sending || !confirmSend || !authorisedList) return
    setSending(true)
    try {
      const res = await authFetch(`/api/founder/outreach/campaigns/${validated.campaign.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmSend: true,
          authorisedList: true,
          confirmCount: validated.campaign.sendableRows,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Send failed')
      toast.success('Campaign send started')
      await refreshCampaign(validated.campaign.id)
      await loadHistory()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Send failed')
    } finally {
      setSending(false)
    }
  }

  async function refreshCampaign(id: string) {
    const res = await authFetch(`/api/founder/outreach/campaigns/${id}?preview=1`)
    const json = await res.json()
    if (res.ok && json.success) setActiveResult(json.data)
  }

  const c = validated?.campaign
  const activeType: OutreachCampaignType =
    validated?.campaign.type || activeResult?.campaign?.type || campaignType

  return (
    <FounderShell
      title="Outreach"
      subtitle="Send approved SME or Youth Agent invitation campaigns"
      actions={
        <Link href="/founder" className="text-sm font-medium text-slate-600 underline">
          Overview
        </Link>
      }
    >
      <div className="space-y-8">
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold text-slate-900">Create outreach campaign</h2>
          <p className="mt-1 text-sm text-slate-600">Choose an audience, then upload a cleaned Excel list.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {AUDIENCE_OPTIONS.map((opt) => {
              const selected = campaignType === opt.type
              return (
                <button
                  key={opt.type}
                  type="button"
                  onClick={() => onAudienceChange(opt.type)}
                  className={`rounded-lg border p-4 text-left transition ${
                    selected
                      ? 'border-emerald-600 bg-emerald-50 ring-1 ring-emerald-600'
                      : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <div className="font-semibold text-slate-900">{opt.label}</div>
                  <p className="mt-1 text-sm text-slate-600">{opt.description}</p>
                </button>
              )
            })}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold text-slate-900">Upload Excel database</h2>
          <p className="mt-1 text-sm text-slate-600">
            Campaign: <strong>{selectedAudience.label}</strong>
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Required columns: <strong>{selectedAudience.columns}</strong>. .xlsx only.
          </p>
          <form onSubmit={onValidate} className="mt-4 flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                File
              </label>
              <input
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="mt-1 block text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={!file || busy}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? 'Validating…' : 'Upload & validate'}
            </button>
          </form>
        </section>

        {validated && c ? (
          <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="text-base font-semibold text-slate-900">Campaign preview</h2>
            <p className="text-sm text-slate-600">
              Audience:{' '}
              <span className="font-medium text-slate-900">
                {validated.emailPreview.audienceLabel}
              </span>
            </p>
            <p className="text-sm text-slate-600">
              File: <span className="font-medium text-slate-900">{c.originalFileName}</span>
            </p>
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6 text-sm">
              <Stat label="Total rows" value={c.totalRows} />
              <Stat label="Valid" value={c.validRows} />
              <Stat label="Invalid" value={c.invalidRows} />
              <Stat label="Duplicates" value={c.duplicateRows} />
              <Stat label="Suppressed" value={c.suppressedRows} />
              <Stat label="Ready to send" value={c.sendableRows} emphasize />
            </div>

            <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
              {isYouth ? (
                <>
                  You are about to send the Youth Agent invitation to{' '}
                  <strong>{c.sendableRows}</strong> recipients.
                </>
              ) : (
                <>
                  You are about to send this invitation to <strong>{c.sendableRows}</strong> SMEs.
                </>
              )}
            </p>

            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 pr-3 font-medium">Name</th>
                    {!isYouth ? (
                      <th className="py-2 pr-3 font-medium">Company Name</th>
                    ) : null}
                    <th className="py-2 pr-3 font-medium">Email</th>
                    <th className="py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {validated.preview.map((r, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="py-2 pr-3">{r.name}</td>
                      {!isYouth ? <td className="py-2 pr-3">{r.companyName}</td> : null}
                      <td className="py-2 pr-3">{r.email}</td>
                      <td className="py-2 capitalize">{r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <div className="font-semibold text-slate-900">Approved email</div>
              <div className="mt-1">Template: {validated.emailPreview.templateVersion}</div>
              <div>Subject: {validated.emailPreview.subject}</div>
              <div>
                CTA: {validated.emailPreview.ctaLabel} → {validated.emailPreview.ctaUrl}
              </div>
              <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded border border-slate-200 bg-white p-2 text-xs text-slate-600">
                {validated.emailPreview.textExcerpt}
              </pre>
            </div>

            <form onSubmit={onSend} className="space-y-3">
              <label className="flex items-start gap-2 text-sm text-slate-800">
                <input
                  type="checkbox"
                  checked={authorisedList}
                  onChange={(e) => setAuthorisedList(e.target.checked)}
                  className="mt-1"
                />
                <span>I confirm this recipient list is authorised for this outreach campaign.</span>
              </label>
              <label className="flex items-start gap-2 text-sm text-slate-800">
                <input
                  type="checkbox"
                  checked={confirmSend}
                  onChange={(e) => setConfirmSend(e.target.checked)}
                  className="mt-1"
                />
                <span>
                  {isYouth
                    ? `I confirm I want to send the Youth Agent invitation to ${c.sendableRows} recipients.`
                    : `I confirm I want to send this invitation to ${c.sendableRows} recipients.`}
                </span>
              </label>
              <button
                type="submit"
                disabled={sending || !confirmSend || !authorisedList || c.sendableRows < 1}
                className="rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {sending
                  ? 'Sending…'
                  : isYouth
                    ? 'SEND YOUTH AGENT INVITATIONS'
                    : 'SEND INVITATIONS'}
              </button>
            </form>
          </section>
        ) : null}

        {activeResult?.campaign ? (
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="text-base font-semibold text-slate-900">Campaign results</h2>
            <p className="mt-1 text-sm text-slate-600">
              Audience:{' '}
              <strong>{audienceLabel(activeResult.campaign.type as OutreachCampaignType)}</strong>
            </p>
            <p className="mt-1 text-sm capitalize text-slate-600">
              Status: <strong>{activeResult.campaign.status.replace(/_/g, ' ')}</strong>
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-4 text-sm">
              <Stat label="Sent" value={activeResult.campaign.sentCount} />
              <Stat label="Failed" value={activeResult.campaign.failedCount} />
              <Stat label="Suppressed" value={activeResult.campaign.suppressedRows} />
              <Stat label="Queued" value={activeResult.campaign.queuedCount} />
            </div>
            {(activeResult.failed || []).length > 0 ? (
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-slate-900">Failed recipients</h3>
                <ul className="mt-2 space-y-1 text-sm text-slate-700">
                  {activeResult.failed.map((f: any, i: number) => (
                    <li key={i}>
                      {f.name}
                      {f.companyName ? ` · ${f.companyName}` : ''} · {f.errorCode || 'failed'}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <button
              type="button"
              className="mt-4 text-sm font-medium underline"
              onClick={() => void refreshCampaign(activeResult.campaign.id)}
            >
              Refresh status
            </button>
          </section>
        ) : null}

        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold text-slate-900">Campaign history</h2>
          {history.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No campaigns yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100 text-sm">
              {history.map((h) => (
                <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div>
                    <div className="font-medium text-slate-900">{h.originalFileName}</div>
                    <div className="text-xs text-slate-500">
                      {audienceLabel(h.type)} · {h.createdAt} · {h.status} · sent {h.sentCount}/
                      {h.sendableRows}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="text-xs font-semibold underline"
                    onClick={() => void refreshCampaign(h.id)}
                  >
                    View
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </FounderShell>
  )
}

function Stat({
  label,
  value,
  emphasize,
}: {
  label: string
  value: number
  emphasize?: boolean
}) {
  return (
    <div
      className={`rounded-md border px-3 py-2 ${
        emphasize ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'
      }`}
    >
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-lg font-semibold text-slate-900">{value}</div>
    </div>
  )
}
