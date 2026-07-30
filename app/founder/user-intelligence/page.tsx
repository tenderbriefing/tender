'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { MagnifyingGlassIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { authFetch } from '@/lib/api/authenticatedFetch'
import { SA_PROVINCES } from '@/lib/procurement/provinces'
import { OverviewPanel } from '@/components/founder/user-intelligence/OverviewPanel'
import {
  AgentIntelligencePanel,
  SmeIntelligencePanel,
} from '@/components/founder/user-intelligence/RolePanels'
import { NetworkPanel } from '@/components/founder/user-intelligence/NetworkPanel'
import { GeographyPanel } from '@/components/founder/user-intelligence/GeographyPanel'
import { ActionCentrePanel } from '@/components/founder/user-intelligence/ActionCentrePanel'
import { UserDetailDrawer } from '@/components/founder/user-intelligence/UserDetailDrawer'
import { ErrorPanel } from '@/components/founder/user-intelligence/chrome'
import type {
  IntelligencePayload,
  IntelligenceTab,
  UserDetailPayload,
} from '@/components/founder/user-intelligence/types'

const TABS: { id: IntelligenceTab; label: string; short: string }[] = [
  { id: 'overview', label: 'Overview', short: 'Overview' },
  { id: 'smes', label: 'SME Intelligence', short: 'SMEs' },
  { id: 'agents', label: 'Youth Agent Intelligence', short: 'Agents' },
  { id: 'network', label: 'Agent–SME Network', short: 'Network' },
  { id: 'geography', label: 'Geography', short: 'Geography' },
  { id: 'actions', label: 'Action Centre', short: 'Actions' },
]

export default function FounderUserIntelligencePage() {
  const [tab, setTab] = useState<IntelligenceTab>('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<IntelligencePayload | null>(null)
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [province, setProvince] = useState('')
  const [page, setPage] = useState(1)
  const [selectedUid, setSelectedUid] = useState<string | null>(null)
  const [detail, setDetail] = useState<UserDetailPayload | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300)
    return () => clearTimeout(t)
  }, [q])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: '25',
        q: debouncedQ,
        province,
      })
      const res = await authFetch(`/api/founder/user-intelligence?${params}`)
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to load intelligence')
      }
      setData(json.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [page, debouncedQ, province])

  useEffect(() => {
    load()
  }, [load])

  const openDetail = async (uid: string) => {
    setSelectedUid(uid)
    setDetailLoading(true)
    setDetail(null)
    try {
      const res = await authFetch(`/api/founder/users/${uid}`)
      const json = await res.json()
      if (json.success) setDetail(json.data)
      else setDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }

  const closeDetail = () => {
    setSelectedUid(null)
    setDetail(null)
  }

  const showFilters = tab === 'smes' || tab === 'agents'

  const generatedLabel = useMemo(() => {
    if (!data?.generatedAt) return null
    try {
      return new Date(data.generatedAt).toLocaleString('en-ZA')
    } catch {
      return null
    }
  }, [data?.generatedAt])

  return (
    <div className="procurement-shell min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-4 border-b border-slate-200/80 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-800">
              Founder · User Intelligence
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-brand-900 sm:text-3xl">
              SME & Youth Agent intelligence
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
              Executive view of separate journeys, engagement, coverage, and interventions —
              not a mixed generic user list.
            </p>
            {generatedLabel && (
              <p className="mt-2 text-[11px] tabular-nums text-slate-400">
                Snapshot · {generatedLabel}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-brand-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
            >
              <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <Link
              href="/admin/dashboard"
              className="text-sm font-semibold text-brand-800 hover:underline"
            >
              ← Admin command center
            </Link>
          </div>
        </header>

        <nav
          className="mb-5 flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm"
          aria-label="Intelligence sections"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTab(t.id)
                setPage(1)
              }}
              className={`whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold transition ${
                tab === t.id
                  ? 'bg-brand-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-brand-900'
              }`}
            >
              <span className="hidden sm:inline">{t.label}</span>
              <span className="sm:hidden">{t.short}</span>
            </button>
          ))}
        </nav>

        {showFilters && (
          <div className="mb-5 flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={q}
                onChange={(e) => {
                  setPage(1)
                  setQ(e.target.value)
                }}
                placeholder={
                  tab === 'smes'
                    ? 'Search SME name, company, email…'
                    : 'Search agent name, email…'
                }
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm shadow-sm outline-none ring-brand-800/20 focus:ring-2"
              />
            </div>
            <select
              value={province}
              onChange={(e) => {
                setPage(1)
                setProvince(e.target.value)
              }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm outline-none ring-brand-800/20 focus:ring-2"
            >
              <option value="">All provinces</option>
              {SA_PROVINCES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        )}

        {loading && !data ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24">
            <LoadingSpinner size="lg" />
            <p className="text-sm text-slate-500">Loading founder intelligence…</p>
          </div>
        ) : error && !data ? (
          <ErrorPanel message={error} onRetry={load} />
        ) : (
          <div className="relative">
            {loading && data && (
              <div className="pointer-events-none absolute inset-0 z-10 rounded-2xl bg-white/40" />
            )}
            {error && data && (
              <div className="mb-4">
                <ErrorPanel message={error} onRetry={load} />
              </div>
            )}

            {tab === 'overview' && data?.overview && (
              <OverviewPanel overview={data.overview} dataNotes={data.dataNotes} />
            )}
            {tab === 'overview' && !data?.overview && (
              <ErrorPanel message="Overview data unavailable" onRetry={load} />
            )}

            {tab === 'smes' && (
              <SmeIntelligencePanel
                data={data?.smes}
                onSelect={openDetail}
                onPageChange={setPage}
              />
            )}

            {tab === 'agents' && (
              <AgentIntelligencePanel
                data={data?.agents}
                onSelect={openDetail}
                onPageChange={setPage}
              />
            )}

            {tab === 'network' && (
              <NetworkPanel network={data?.network} onSelect={openDetail} />
            )}

            {tab === 'geography' && <GeographyPanel geography={data?.geography} />}

            {tab === 'actions' && <ActionCentrePanel actions={data?.actions} />}
          </div>
        )}

        <UserDetailDrawer
          open={Boolean(selectedUid)}
          loading={detailLoading}
          detail={detail}
          onClose={closeDetail}
        />
      </main>
      <Footer />
    </div>
  )
}
