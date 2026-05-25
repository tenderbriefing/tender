'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { authFetch } from '@/lib/api/authenticatedFetch'

interface WorkflowEvent {
  id: string
  type?: string
  status?: string
  startedAt?: string
  completedAt?: string
  retryCount?: number
  error?: string
}

interface AutomationHealth {
  workflow?: {
    total?: number
    byStatus?: Record<string, number>
    recent?: WorkflowEvent[]
    failedQueue?: WorkflowEvent[]
    slaBreaches?: number
  }
  whatsapp?: {
    configured?: boolean
    sent?: number
    failed?: number
    pending?: number
    lastSentAt?: string | null
  }
  push?: { status?: string; name?: string }
}

export default function WorkflowOperationsPanel() {
  const [health, setHealth] = useState<AutomationHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [retrying, setRetrying] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await authFetch('/api/admin/automation-health')
      const json = await res.json()
      if (json.success) setHealth(json.data)
    } catch {
      toast.error('Failed to load automation health')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 45000)
    return () => clearInterval(t)
  }, [load])

  const retryFailed = async () => {
    setRetrying(true)
    try {
      const res = await authFetch('/api/admin/notifications/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 15 }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(`Retried ${json.data?.retried ?? 0}, sent ${json.data?.sent ?? 0}`)
        load()
      } else {
        toast.error(json.error || 'Retry failed')
      }
    } catch {
      toast.error('Retry request failed')
    } finally {
      setRetrying(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner />
      </div>
    )
  }

  const wf = health?.workflow
  const wa = health?.whatsapp

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Workflow automation
          </h2>
          <p className="text-sm text-slate-500">
            Live orchestration, WhatsApp delivery, SLA escalations
          </p>
        </div>
        <button
          type="button"
          onClick={retryFailed}
          disabled={retrying}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {retrying ? 'Retrying…' : 'Retry failed WhatsApp'}
        </button>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Workflow events" value={String(wf?.total ?? 0)} />
        <Metric label="SLA escalations" value={String(wf?.slaBreaches ?? 0)} />
        <Metric
          label="WhatsApp sent"
          value={String(wa?.sent ?? 0)}
          sub={wa?.configured ? 'configured' : 'not configured'}
        />
        <Metric label="WhatsApp failed" value={String(wa?.failed ?? 0)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
            Recent workflow events
          </h3>
          <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
            {(wf?.recent || []).slice(0, 12).map((e) => (
              <li
                key={e.id}
                className="flex justify-between gap-2 rounded border border-slate-100 px-2 py-1 dark:border-slate-800"
              >
                <span className="truncate font-mono text-xs">{e.type || e.id}</span>
                <StatusPill status={e.status} />
              </li>
            ))}
            {!wf?.recent?.length && (
              <li className="text-slate-500">No workflow events yet</li>
            )}
          </ul>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
            Failed / retry queue
          </h3>
          <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
            {(wf?.failedQueue || []).slice(0, 8).map((e) => (
              <li
                key={e.id}
                className="rounded border border-amber-100 bg-amber-50/50 px-2 py-1 text-xs dark:border-amber-900/40 dark:bg-amber-950/20"
              >
                <span className="font-medium">{e.type}</span>
                {e.error ? (
                  <span className="block truncate text-amber-800 dark:text-amber-200">
                    {e.error}
                  </span>
                ) : null}
              </li>
            ))}
            {!wf?.failedQueue?.length && (
              <li className="text-slate-500">No failed workflow jobs</li>
            )}
          </ul>
        </div>
      </div>
    </section>
  )
}

function Metric({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-800/50">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-xl font-semibold text-slate-900 dark:text-slate-100">{value}</p>
      {sub ? <p className="text-xs text-slate-400">{sub}</p> : null}
    </div>
  )
}

function StatusPill({ status }: { status?: string }) {
  const colors: Record<string, string> = {
    completed: 'bg-emerald-100 text-emerald-800',
    failed: 'bg-red-100 text-red-800',
    running: 'bg-blue-100 text-blue-800',
    retry_pending: 'bg-amber-100 text-amber-800',
  }
  const cls = colors[status || ''] || 'bg-slate-100 text-slate-600'
  return (
    <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs ${cls}`}>{status || '—'}</span>
  )
}
