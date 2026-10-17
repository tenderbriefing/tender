'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'react-hot-toast'
import { FounderShell } from '@/components/founder/FounderShell'
import { authFetch } from '@/lib/api/authenticatedFetch'
import { isFounderSmeOutreachEnabledClient } from '@/lib/founder/outreach/clientFlag'

type MetricsPayload = {
  metrics: {
    submitted: number
    providerDelivered: number
    bounced: number
    complained: number
    failed: number
    suppressedRecipientsNoted: number
    providerDeliveryRate: number | null
    bounceRate: number | null
    complaintRate: number | null
    campaignsScanned: number
    disclaimer: string
    founderVerifiedInbox: {
      primary: number
      promotions: number
      spam: number
      other: number
      not_found: number
      not_checked: number
      total: number
    }
    auth: {
      checks: Array<{ id: string; title: string; status: string; detail: string }>
      dnsChangeRecommendations: Array<{ priority: string; summary: string; riskIfChanged: string }>
      disclaimer: string
    }
    runtime: {
      paused: boolean
      pauseReason: string | null
      bulkAuthorized: boolean
      controlledMaxRecipients: number
    }
  }
  placements: Array<{
    id: string
    campaignId: string
    deliveryId: string
    recipientEmail: string
    provider: string
    placement: string
    notedAt: string
    notes: string | null
  }>
  sendersLockedTo: string
}

function pct(n: number | null): string {
  if (n == null || Number.isNaN(n)) return '—'
  return `${(n * 100).toFixed(1)}%`
}

export default function OutreachDeliverabilityPage() {
  const flagOn = isFounderSmeOutreachEnabledClient()
  const [data, setData] = useState<MetricsPayload | null>(null)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    campaignId: '',
    deliveryId: '',
    providerMessageId: '',
    recipientEmail: '',
    provider: 'gmail',
    placement: 'not_checked',
    notes: '',
  })

  const load = useCallback(async () => {
    if (!flagOn) return
    setBusy(true)
    try {
      const res = await authFetch('/api/founder/outreach/deliverability')
      const json = await res.json()
      if (!res.ok || !json.success) {
        toast.error(json.error || 'Failed to load deliverability metrics')
        return
      }
      setData(json.data)
    } catch {
      toast.error('Network error loading deliverability')
    } finally {
      setBusy(false)
    }
  }, [flagOn])

  useEffect(() => {
    void load()
  }, [load])

  async function submitPlacement() {
    setBusy(true)
    try {
      const res = await authFetch('/api/founder/outreach/deliverability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'record_inbox_placement', ...form }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        toast.error(json.error || 'Failed to record placement')
        return
      }
      toast.success('Inbox placement recorded')
      await load()
    } catch {
      toast.error('Network error')
    } finally {
      setBusy(false)
    }
  }

  if (!flagOn) {
    return (
      <FounderShell title="Deliverability" subtitle="Outreach email protection">
        <p className="text-sm text-amber-800">Founder Outreach is disabled.</p>
      </FounderShell>
    )
  }

  const m = data?.metrics

  return (
    <FounderShell
      title="Deliverability"
      subtitle="Provider delivery vs Founder-verified inbox placement"
      actions={
        <Link href="/founder/outreach" className="text-sm font-semibold text-brand-800 hover:underline">
          ← Compose
        </Link>
      }
    >
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-semibold">Bulk outreach remains BLOCKED.</p>
          <p className="mt-1">
            Sender locked to <code>{data?.sendersLockedTo || 'TenderBriefing &lt;hello@tenderbriefing.co.za&gt;'}</code>.
            Controlled max recipients:{' '}
            <strong>{m?.runtime.controlledMaxRecipients ?? 5}</strong>. Provider delivery is not Primary Inbox.
          </p>
          {m?.runtime.paused ? (
            <p className="mt-2 font-semibold text-red-800">
              Sending paused: {m.runtime.pauseReason || 'reputation controls'}
            </p>
          ) : null}
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Submitted', m?.submitted],
            ['Provider delivered', m?.providerDelivered],
            ['Bounced', m?.bounced],
            ['Complaints', m?.complained],
            ['Failed', m?.failed],
            ['Suppressed (campaign notes)', m?.suppressedRecipientsNoted],
            ['Provider delivery rate', pct(m?.providerDeliveryRate ?? null)],
            ['Bounce rate', pct(m?.bounceRate ?? null)],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
              <p className="mt-1 text-2xl font-bold text-brand-900">{value ?? '—'}</p>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-brand-900">Founder-verified inbox placement</h2>
          <p className="mt-1 text-sm text-slate-600">
            Only manually recorded observations. Never inferred from Resend.
          </p>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
            {Object.entries(m?.founderVerifiedInbox || {}).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-2 border-b border-slate-100 py-1">
                <dt className="text-slate-500">{k}</dt>
                <dd className="font-semibold">{v as number}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-brand-900">Authentication audit</h2>
            <button
              type="button"
              onClick={() => void load()}
              disabled={busy}
              className="text-xs font-semibold text-brand-800 hover:underline"
            >
              Refresh
            </button>
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {(m?.auth.checks || []).map((c) => (
              <li key={c.id} className="rounded-xl border border-slate-100 px-3 py-2">
                <p className="font-semibold text-brand-900">
                  <span className="mr-2 uppercase text-xs text-slate-500">{c.status}</span>
                  {c.title}
                </p>
                <p className="mt-0.5 text-slate-600">{c.detail}</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-500">{m?.auth.disclaimer}</p>
          {(m?.auth.dnsChangeRecommendations || []).length > 0 ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="font-semibold text-brand-900">DNS changes requiring Founder approval</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-700">
                {m!.auth.dnsChangeRecommendations.map((r, i) => (
                  <li key={i}>
                    <span className="uppercase text-xs text-slate-500">{r.priority}</span> — {r.summary}{' '}
                    <span className="text-slate-500">({r.riskIfChanged})</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-brand-900">Record inbox placement (manual)</h2>
          <p className="mt-1 text-sm text-slate-600">
            Controlled test workflow — does not send email. Founder observes mailbox and records placement.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {(
              [
                ['campaignId', 'Campaign ID'],
                ['deliveryId', 'Delivery ID'],
                ['providerMessageId', 'Resend message ID (optional)'],
                ['recipientEmail', 'Recipient email'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="text-sm">
                <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">{label}</span>
                <input
                  className="w-full rounded-xl border border-slate-200 px-3 py-2"
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                />
              </label>
            ))}
            <label className="text-sm">
              <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Provider</span>
              <select
                className="w-full rounded-xl border border-slate-200 px-3 py-2"
                value={form.provider}
                onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))}
              >
                <option value="gmail">Gmail</option>
                <option value="outlook">Outlook</option>
                <option value="yahoo">Yahoo</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Placement</span>
              <select
                className="w-full rounded-xl border border-slate-200 px-3 py-2"
                value={form.placement}
                onChange={(e) => setForm((f) => ({ ...f, placement: e.target.value }))}
              >
                <option value="primary">Primary Inbox</option>
                <option value="promotions">Promotions</option>
                <option value="spam">Spam</option>
                <option value="other">Other</option>
                <option value="not_found">Not found</option>
                <option value="not_checked">Not checked</option>
              </select>
            </label>
          </div>
          <label className="mt-3 block text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Notes</span>
            <textarea
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => void submitPlacement()}
            className="mt-4 rounded-xl bg-accent-500 px-4 py-2 text-sm font-bold text-brand-900 hover:bg-accent-400 disabled:opacity-60"
          >
            Save placement observation
          </button>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-brand-900">Recent placement observations</h2>
          {(data?.placements || []).length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">None recorded yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100 text-sm">
              {data!.placements.map((p) => (
                <li key={p.id} className="py-2">
                  <p className="font-semibold text-brand-900">
                    {p.recipientEmail} · {p.provider} · {p.placement}
                  </p>
                  <p className="text-xs text-slate-500">
                    {new Date(p.notedAt).toLocaleString()} · {p.campaignId}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="text-xs text-slate-500">{m?.disclaimer}</p>
      </div>
    </FounderShell>
  )
}
