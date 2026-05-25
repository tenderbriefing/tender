'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { auth } from '@/lib/firebase'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import PilotTasksPanel from '@/components/admin/PilotTasksPanel'
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  RocketLaunchIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline'

interface PilotDashboard {
  capturedAt: string
  targets: { smes: number; agents: number; briefingRequests: number }
  progress: {
    smes: { current: number; onboarded: number; target: number; pct: number; onboardedPct?: number }
    agents: { current: number; onboarded: number; target: number; pct: number; onboardedPct?: number }
    briefingRequests: { current: number; target: number; pct: number }
  }
  operations: {
    activeRequests: number
    completedRequests: number
    completedReports: number
    paidRequests: number
    dispatchSuccessRate: number | null
    whatsapp: {
      configured: boolean
      sent: number
      failed: number
      pending: number
      healthPct: number | null
    }
  }
  crm?: {
    leadsByStatus: Record<string, number>
    leadConversionPct: number | null
    outreachSent: number
    outreachTotal: number
    openTasks: number
    feedbackAvgRating: number | null
    verifiedAgents?: number
  }
  enhanced?: {
    onboardedSmes: number
    onboardedAgents: number
    onboardingPctSme: number | null
    onboardingPctAgent: number | null
    verifiedAgents: number
    completedBriefings: number
    slaBreachCount: number
    whatsappDeliverySuccess: number | null
    conversionFunnel: {
      leadsTotal: number
      leadsOnboarded: number
      requestsTotal: number
      requestsPaid: number
      requestsCompleted: number
      paymentConversionPct: number | null
    }
  }
  pilotReady: boolean
}

function ProgressBar({ pct, label }: { pct: number; label: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="text-slate-600">{pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-brand-600 transition-all"
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
    </div>
  )
}

export default function PilotLaunchPanel() {
  const [data, setData] = useState<PilotDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const token = await auth.currentUser?.getIdToken()
      if (!token) {
        setError('Sign in required')
        return
      }
      const res = await fetch('/api/admin/pilot-metrics', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Failed to load pilot metrics')
      setData(json.data)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [load])

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800">
        {error || 'No data'}
      </div>
    )
  }

  const e = data.enhanced
  const funnel = e?.conversionFunnel

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div
          className={`flex flex-1 items-start gap-4 rounded-2xl border p-6 ${
            data.pilotReady
              ? 'border-emerald-200 bg-emerald-50'
              : 'border-amber-200 bg-amber-50'
          }`}
        >
          {data.pilotReady ? (
            <CheckCircleIcon className="h-8 w-8 shrink-0 text-emerald-600" />
          ) : (
            <RocketLaunchIcon className="h-8 w-8 shrink-0 text-amber-600" />
          )}
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {data.pilotReady ? 'Pilot targets met' : 'Controlled pilot in progress'}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Targets: {data.targets.smes} SMEs · {data.targets.agents} agents ·{' '}
              {data.targets.briefingRequests} requests · Updated{' '}
              {new Date(data.capturedAt).toLocaleString('en-ZA')}
            </p>
          </div>
        </div>
        <Link
          href="/admin/pilot/leads"
          className="rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Manage leads →
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <UserGroupIcon className="h-5 w-5 text-brand-600" />
            <h3 className="font-semibold text-slate-900">SMEs</h3>
          </div>
          <p className="mt-3 text-3xl font-bold text-slate-900">
            {data.progress.smes.current}
            <span className="text-lg font-normal text-slate-500">
              {' '}
              / {data.progress.smes.target}
            </span>
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {e?.onboardedSmes ?? data.progress.smes.onboarded} onboarding complete (
            {e?.onboardingPctSme ?? '—'}%)
          </p>
          <div className="mt-4">
            <ProgressBar pct={data.progress.smes.pct} label="Registration" />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <UserGroupIcon className="h-5 w-5 text-brand-600" />
            <h3 className="font-semibold text-slate-900">Youth Agents</h3>
          </div>
          <p className="mt-3 text-3xl font-bold text-slate-900">
            {data.progress.agents.current}
            <span className="text-lg font-normal text-slate-500">
              {' '}
              / {data.progress.agents.target}
            </span>
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {e?.onboardedAgents ?? data.progress.agents.onboarded} onboarded ·{' '}
            {e?.verifiedAgents ?? 0} verified
          </p>
          <div className="mt-4">
            <ProgressBar pct={data.progress.agents.pct} label="Registration" />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="font-semibold text-slate-900">Briefing requests</h3>
          <p className="mt-3 text-3xl font-bold text-slate-900">
            {data.progress.briefingRequests.current}
            <span className="text-lg font-normal text-slate-500">
              {' '}
              / {data.progress.briefingRequests.target}
            </span>
          </p>
          <div className="mt-4">
            <ProgressBar
              pct={data.progress.briefingRequests.pct}
              label="Request volume"
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Operations
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Active requests" value={data.operations.activeRequests} />
          <Metric
            label="Completed briefings"
            value={e?.completedBriefings ?? data.operations.completedReports}
          />
          <Metric
            label="Dispatch success"
            value={
              data.operations.dispatchSuccessRate != null
                ? `${data.operations.dispatchSuccessRate}%`
                : '—'
            }
          />
          <Metric
            label="WhatsApp delivery"
            value={
              e?.whatsappDeliverySuccess != null
                ? `${e.whatsappDeliverySuccess}%`
                : data.operations.whatsapp.healthPct != null
                  ? `${data.operations.whatsapp.healthPct}%`
                  : '—'
            }
          />
          <Metric label="SLA breaches (recent)" value={e?.slaBreachCount ?? 0} />
          <Metric label="CRM leads" value={funnel?.leadsTotal ?? 0} />
          <Metric
            label="Lead → onboarded"
            value={
              data.crm?.leadConversionPct != null ? `${data.crm.leadConversionPct}%` : '—'
            }
          />
          <Metric label="Open pilot tasks" value={data.crm?.openTasks ?? 0} />
        </div>
      </div>

      {funnel && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h3 className="font-semibold text-slate-900">Conversion funnel</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-5 text-center text-sm">
            {[
              ['Leads', funnel.leadsTotal],
              ['Onboarded leads', funnel.leadsOnboarded],
              ['Registered SMEs', funnel.requestsTotal > 0 ? e?.onboardedSmes : data.progress.smes.current],
              ['Paid requests', funnel.requestsPaid],
              ['Completed', funnel.requestsCompleted],
            ].map(([label, val]) => (
              <div key={String(label)} className="rounded-lg bg-slate-50 py-3">
                <p className="text-2xl font-bold text-brand-700">{val as number}</p>
                <p className="text-slate-600">{label as string}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-center text-sm text-slate-500">
            Payment conversion: {funnel.paymentConversionPct ?? '—'}% · Feedback avg:{' '}
            {data.crm?.feedbackAvgRating ?? '—'} / 5 · Outreach sent:{' '}
            {data.crm?.outreachSent ?? 0}
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h3 className="font-semibold text-slate-900">WhatsApp</h3>
          {data.operations.whatsapp.configured ? (
            <p className="mt-2 text-sm text-slate-600">
              Sent {data.operations.whatsapp.sent} · Failed {data.operations.whatsapp.failed} ·
              Pending {data.operations.whatsapp.pending}
            </p>
          ) : (
            <p className="mt-2 inline-flex items-center gap-1 text-sm text-amber-700">
              <ExclamationTriangleIcon className="h-4 w-4" />
              Twilio not configured — copy outreach from leads manager
            </p>
          )}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h3 className="font-semibold text-slate-900">Lead pipeline</h3>
          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            {Object.entries(data.crm?.leadsByStatus || {}).map(([k, v]) => (
              <li key={k}>
                {k}: {v}
              </li>
            ))}
            {!Object.keys(data.crm?.leadsByStatus || {}).length && (
              <li>No CRM leads yet — add leads to track outreach.</li>
            )}
          </ul>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/pilot/sme"
          className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm font-semibold text-brand-800 hover:bg-brand-100"
        >
          Public SME pilot landing →
        </Link>
        <Link
          href="/pilot/agent"
          className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm font-semibold text-brand-800 hover:bg-brand-100"
        >
          Public agent pilot landing →
        </Link>
      </div>

      <PilotTasksPanel />
    </div>
  )
}
