'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import type { IntegrationHealthItem, IntegrationsHealthResponse } from '@/lib/backend/integrations'
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  MinusCircleIcon,
  PuzzlePieceIcon,
} from '@heroicons/react/24/outline'

function StatusBadge({ status }: { status: IntegrationHealthItem['status'] }) {
  if (status === 'configured') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
        <CheckCircleIcon className="h-4 w-4" />
        configured
      </span>
    )
  }
  if (status === 'error') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-800">
        <ExclamationCircleIcon className="h-4 w-4" />
        error
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
      <MinusCircleIcon className="h-4 w-4" />
      missing
    </span>
  )
}

export default function IntegrationsDashboard() {
  const [health, setHealth] = useState<IntegrationsHealthResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/integrations/health')
      const json = await res.json()
      if (!res.ok || !json.ok) {
        throw new Error(json.error || 'Failed to load integration health')
      }
      setHealth(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800">
        <p>{error}</p>
        <button
          type="button"
          onClick={load}
          className="mt-4 text-sm font-medium text-red-900 underline"
        >
          Retry
        </button>
      </div>
    )
  }

  const summary = health?.summary

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <PuzzlePieceIcon className="h-8 w-8 text-brand-600" />
            Platform integrations
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Connection status only — secret values are never shown. Last checked:{' '}
            {health?.checkedAt
              ? new Date(health.checkedAt).toLocaleString('en-ZA')
              : '—'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <ArrowPathIcon className="h-4 w-4" />
            Refresh
          </button>
          <Link
            href="/admin/dashboard"
            className="inline-flex items-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Back to dashboard
          </Link>
        </div>
      </div>

      {summary ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium text-slate-500">Total</p>
            <p className="text-2xl font-bold text-slate-900">{summary.total}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs font-medium text-emerald-700">Configured</p>
            <p className="text-2xl font-bold text-emerald-900">{summary.configured}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-medium text-slate-600">Missing</p>
            <p className="text-2xl font-bold text-slate-900">{summary.missing}</p>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-xs font-medium text-red-700">Error</p>
            <p className="text-2xl font-bold text-red-900">{summary.error}</p>
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                Integration
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                Required env
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                Setup notes
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(health?.integrations || []).map((item) => (
              <tr key={item.id} className="align-top">
                <td className="px-4 py-4">
                  <p className="font-medium text-slate-900">{item.name}</p>
                  <p className="text-xs text-slate-500">{item.id}</p>
                  {item.message ? (
                    <p className="mt-1 text-xs text-slate-600">{item.message}</p>
                  ) : null}
                </td>
                <td className="px-4 py-4">
                  <StatusBadge status={item.status} />
                  <p className="mt-2 text-xs text-slate-500">
                    {new Date(item.lastChecked).toLocaleString('en-ZA')}
                  </p>
                </td>
                <td className="px-4 py-4">
                  <ul className="space-y-1 text-xs font-mono text-slate-700">
                    {item.requiredEnv.map((key) => (
                      <li
                        key={key}
                        className={
                          item.missing.includes(key) ? 'text-amber-700' : 'text-slate-600'
                        }
                      >
                        {key}
                      </li>
                    ))}
                  </ul>
                </td>
                <td className="px-4 py-4 text-sm text-slate-600 max-w-md">
                  {item.setupNotes}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-sm text-slate-500">
        See <code className="rounded bg-slate-100 px-1">docs/API_INTEGRATIONS.md</code> for
        credential setup and Secret Manager names.
      </p>
    </div>
  )
}
