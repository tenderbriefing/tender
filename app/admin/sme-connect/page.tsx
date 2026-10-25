'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ProcurementPageHeader from '@/components/procurement/ProcurementPageHeader'
import { useAuth } from '@/components/providers/AuthProvider'
import { authFetch } from '@/lib/api/authenticatedFetch'

type Rec = {
  id: string
  status?: string
  matchBand?: string
  tenderNumber?: string
  newTenderNumber?: string
  tenderTitle?: string
  newTenderTitle?: string
  newTenderDescription?: string
  newTenderEntity?: string
  briefingDate?: string | null
  briefingTime?: string | null
  briefingVenue?: string | null
  smeName?: string | null
  smeCompany?: string | null
  contactName?: string | null
  contactEmail?: string | null
  previousTenderTitle?: string | null
  previousTenderNumber?: string | null
  previousEntity?: string | null
  previousPaidAt?: string | null
  similarityScore?: number
  similarity?: number
  components?: Record<string, number>
  reasons?: string[]
  customerNotified?: boolean
  providerMessageId?: string | null
  providerDeliveryStatus?: string | null
}

type Audit = Record<string, unknown>
type Funnel = Record<string, unknown>

export default function AdminSmeConnectPage() {
  const { user, userProfile, loading } = useAuth()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [rows, setRows] = useState<Rec[]>([])
  const [selected, setSelected] = useState<Rec | null>(null)
  const [audit, setAudit] = useState<Audit | null>(null)
  const [funnel, setFunnel] = useState<Funnel | null>(null)

  const load = useCallback(async () => {
    const [listRes, auditRes, funnelRes] = await Promise.all([
      authFetch('/api/admin/sme-connect?limit=200'),
      authFetch('/api/admin/sme-connect?view=audit'),
      authFetch('/api/admin/sme-connect?view=funnel'),
    ])
    const listJson = await listRes.json()
    const auditJson = await auditRes.json()
    const funnelJson = await funnelRes.json()
    if (listJson.success) setRows(listJson.data || [])
    else toast.error(listJson.error || 'Failed to load recommendations')
    if (auditJson.success) setAudit(auditJson.data)
    if (funnelJson.success) setFunnel(funnelJson.data)
  }, [])

  useEffect(() => {
    if (!loading) {
      if (!user) router.push('/auth/signin')
      else if (userProfile?.userType !== 'admin') router.push('/dashboard')
    }
  }, [user, userProfile, loading, router])

  useEffect(() => {
    if (user && userProfile?.userType === 'admin') {
      load().catch(() => toast.error('Load failed'))
    }
  }, [user, userProfile, load])

  async function runAction(action: string, body: Record<string, unknown> = {}) {
    setBusy(true)
    try {
      const res = await authFetch('/api/admin/sme-connect', {
        method: 'POST',
        body: JSON.stringify({ action, ...body }),
      })
      const json = await res.json()
      if (!json.success) {
        toast.error(json.error || 'Action failed')
        return
      }
      toast.success(`${action} OK`)
      await load()
      if (body.id && json.data?.candidate) setSelected(json.data.candidate as Rec)
      else if (body.id && json.data?.id) setSelected(json.data as Rec)
    } catch {
      toast.error('Action failed')
    } finally {
      setBusy(false)
    }
  }

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
        title="SME Connect"
        description="Match new compulsory briefings to historically paid SMEs. Approve before any outreach. Certification sends go to a TenderBriefing test inbox only."
        breadcrumb={{ label: 'eTenders mirror', href: '/admin/etenders-mirror' }}
      />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            className="rounded-lg bg-brand-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
            onClick={() => runAction('backtest', { limit: 100, minScore: 0.65, persist: true })}
          >
            Backtest matching
          </button>
          <button
            type="button"
            disabled={busy}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-60"
            onClick={() => load()}
          >
            Refresh
          </button>
          <Link
            href="/admin/etenders-mirror"
            className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            Mirror days
          </Link>
        </div>

        {audit ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Total requests" value={Number(audit.totalRequests || 0)} />
            <Stat label="Paid requests" value={Number(audit.paidRequests || 0)} />
            <Stat label="Paid SMEs" value={Number(audit.paidSmes || 0)} />
            <Stat label="Eligible (live)" value={Number(audit.eligibleLiveMatching || audit.eligibleForMatching || 0)} />
          </div>
        ) : null}

        {funnel ? (
          <div className="rounded-lg border border-slate-200 bg-white p-4 text-xs text-slate-700">
            Funnel: candidates {String(funnel.candidateMatches)} · high {String(funnel.highConfidence)} ·
            review {String(funnel.review)} · approved {String(funnel.approved)} · sent{' '}
            {String(funnel.sent)} · delivered {String(funnel.delivered)} · clicked{' '}
            {String(funnel.clicked)} · paid {String(funnel.paid)}
          </div>
        ) : null}

        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          APPROVE OUTREACH enables send. Default send uses the cert test inbox (not the live SME)
          unless explicitly authorized.
        </p>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                <tr>
                  <th className="px-3 py-2">Band</th>
                  <th className="px-3 py-2">New tender</th>
                  <th className="px-3 py-2">SME</th>
                  <th className="px-3 py-2">Score</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className={`cursor-pointer border-t border-slate-100 hover:bg-slate-50 ${selected?.id === r.id ? 'bg-sky-50' : ''}`}
                    onClick={() => setSelected(r)}
                  >
                    <td className="px-3 py-2 text-xs font-semibold">{r.matchBand || '—'}</td>
                    <td className="max-w-[10rem] truncate px-3 py-2 text-xs">
                      {r.newTenderNumber || r.tenderNumber || '—'}
                    </td>
                    <td className="max-w-[10rem] truncate px-3 py-2 text-xs">
                      {r.smeCompany || r.smeName || '—'}
                    </td>
                    <td className="px-3 py-2 font-semibold">
                      {(r.similarityScore ?? r.similarity)?.toFixed?.(2) ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-xs">{r.status || '—'}</td>
                  </tr>
                ))}
                {!rows.length ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-10 text-center text-slate-500">
                      No candidates. Run backtest matching.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            {!selected ? (
              <p className="text-sm text-slate-500">Select a candidate to review.</p>
            ) : (
              <div className="space-y-4 text-sm">
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    New opportunity
                  </h3>
                  <p className="mt-1 font-mono text-xs">
                    {selected.newTenderNumber || selected.tenderNumber}
                  </p>
                  <p className="font-medium">{selected.newTenderTitle || selected.tenderTitle}</p>
                  <p className="text-slate-600">{selected.newTenderEntity || '—'}</p>
                  <p className="mt-2 text-xs text-slate-600">
                    {selected.newTenderDescription || '—'}
                  </p>
                  <p className="mt-2 text-xs">
                    Briefing: {selected.briefingDate || '—'} {selected.briefingTime || ''} ·{' '}
                    {selected.briefingVenue || '—'}
                  </p>
                </section>
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Matched customer
                  </h3>
                  <p className="font-medium">{selected.smeCompany || selected.smeName}</p>
                  <p className="text-xs">{selected.contactName}</p>
                  <p className="text-xs text-slate-600">{selected.contactEmail}</p>
                </section>
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Why we matched it
                  </h3>
                  <p className="text-xs">
                    Previous: {selected.previousTenderNumber} — {selected.previousTenderTitle}
                  </p>
                  <p className="text-xs text-slate-600">
                    Entity: {selected.previousEntity || '—'} · Paid:{' '}
                    {selected.previousPaidAt || '—'}
                  </p>
                  <p className="mt-1 font-semibold">
                    Score {(selected.similarityScore ?? selected.similarity)?.toFixed?.(2)} (
                    {selected.matchBand})
                  </p>
                  <p className="text-xs text-slate-600">
                    {(selected.reasons || []).join(', ') || '—'}
                  </p>
                  {selected.components ? (
                    <pre className="mt-2 overflow-auto rounded bg-slate-950 p-2 text-[10px] text-slate-100">
                      {JSON.stringify(selected.components, null, 2)}
                    </pre>
                  ) : null}
                </section>
                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    type="button"
                    disabled={busy}
                    className="rounded bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                    onClick={() => runAction('approve', { id: selected.id })}
                  >
                    APPROVE OUTREACH
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className="rounded border border-slate-300 px-3 py-1.5 text-xs disabled:opacity-40"
                    onClick={() => runAction('reject', { id: selected.id })}
                  >
                    REJECT
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className="rounded border border-amber-400 px-3 py-1.5 text-xs text-amber-950 disabled:opacity-40"
                    onClick={() => runAction('dismiss_bad_match', { id: selected.id })}
                  >
                    DISMISS AS BAD MATCH
                  </button>
                  <button
                    type="button"
                    disabled={busy || !['HUMAN_APPROVED', 'READY_FOR_OUTREACH'].includes(String(selected.status))}
                    className="rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                    onClick={() =>
                      runAction('send', {
                        id: selected.id,
                        // Controlled cert default — test inbox
                        overrideRecipient: 'info@tenderbriefing.co.za',
                      })
                    }
                  >
                    SEND (test inbox)
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  )
}
