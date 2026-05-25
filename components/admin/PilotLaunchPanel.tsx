'use client'

import { useCallback, useEffect, useState } from 'react'
import { auth } from '@/lib/firebase'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  RocketLaunchIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline'

interface PilotMetrics {
  capturedAt: string
  targets: { smes: number; agents: number; briefingRequests: number }
  progress: {
    smes: { current: number; onboarded: number; target: number; pct: number }
    agents: { current: number; onboarded: number; target: number; pct: number }
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

export default function PilotLaunchPanel() {
  const [data, setData] = useState<PilotMetrics | null>(null)
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

  return (
    <div className="space-y-8">
      <div
        className={`flex items-start gap-4 rounded-2xl border p-6 ${
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
            {data.pilotReady ? 'Pilot targets met' : 'Pilot launch in progress'}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Targets: {data.targets.smes} SMEs · {data.targets.agents} Youth Agents ·{' '}
            {data.targets.briefingRequests} briefing requests. Updated{' '}
            {new Date(data.capturedAt).toLocaleString('en-ZA')}.
          </p>
        </div>
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
            {data.progress.smes.onboarded} completed onboarding
          </p>
          <div className="mt-4">
            <ProgressBar pct={data.progress.smes.pct} label="Registration progress" />
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
            {data.progress.agents.onboarded} completed onboarding
          </p>
          <div className="mt-4">
            <ProgressBar pct={data.progress.agents.pct} label="Registration progress" />
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Active requests', value: data.operations.activeRequests },
          { label: 'Completed requests', value: data.operations.completedRequests },
          { label: 'Reports uploaded', value: data.operations.completedReports },
          { label: 'Paid requests', value: data.operations.paidRequests },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <p className="text-sm text-slate-500">{item.label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h3 className="font-semibold text-slate-900">Dispatch success</h3>
          <p className="mt-2 text-3xl font-bold text-brand-700">
            {data.operations.dispatchSuccessRate != null
              ? `${data.operations.dispatchSuccessRate}%`
              : '—'}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Paid requests with agent assignment or acceptance
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h3 className="font-semibold text-slate-900">WhatsApp notification health</h3>
          <p className="mt-2 text-3xl font-bold text-brand-700">
            {data.operations.whatsapp.healthPct != null
              ? `${data.operations.whatsapp.healthPct}%`
              : '—'}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {data.operations.whatsapp.configured ? (
              <>
                Sent {data.operations.whatsapp.sent} · Failed{' '}
                {data.operations.whatsapp.failed} · Pending{' '}
                {data.operations.whatsapp.pending}
              </>
            ) : (
              <span className="inline-flex items-center gap-1 text-amber-700">
                <ExclamationTriangleIcon className="h-4 w-4" />
                Twilio not configured on server
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}
