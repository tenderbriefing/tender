'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { MagnifyingGlassIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import { FounderShell } from '@/components/founder/FounderShell'
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
  { id: 'smes', label: 'SMEs', short: 'SMEs' },
  { id: 'agents', label: 'Youth Agents', short: 'Agents' },
  { id: 'network', label: 'Network', short: 'Network' },
  { id: 'geography', label: 'Geography', short: 'Geo' },
  { id: 'actions', label: 'Actions', short: 'Actions' },
]

const VALID_TABS = new Set<IntelligenceTab>(TABS.map((t) => t.id))

function tabFromParam(raw: string | null): IntelligenceTab {
  if (raw && VALID_TABS.has(raw as IntelligenceTab)) return raw as IntelligenceTab
  return 'overview'
}

function IntelligenceFallback() {
  return (
    <FounderShell title="User Intelligence" subtitle="Loading…">
      <div className="flex flex-col items-center justify-center gap-3 py-24">
        <LoadingSpinner size="lg" />
      </div>
    </FounderShell>
  )
}

function FounderUserIntelligenceInner() {
  const searchParams = useSearchParams()
  const [tab, setTab] = useState<IntelligenceTab>(() => tabFromParam(searchParams.get('tab')))
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
    setTab(tabFromParam(searchParams.get('tab')))
  }, [searchParams])

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

  const selectTab = (id: IntelligenceTab) => {
    setTab(id)
    setPage(1)
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      if (id === 'overview') url.searchParams.delete('tab')
      else url.searchParams.set('tab', id)
      window.history.replaceState({}, '', url.toString())
    }
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
    <FounderShell
      title="User Intelligence"
      subtitle="Separate SME and Youth Agent journeys — engagement, coverage, and what needs action."
      actions={
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-brand-800 transition hover:bg-slate-50 disabled:opacity-50"
        >
          <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      }
    >
      <div className="space-y-5">
        {generatedLabel ? (
          <p className="text-xs tabular-nums text-slate-400">Snapshot · {generatedLabel}</p>
        ) : null}

        <div
          role="tablist"
          aria-label="Intelligence sections"
          className="flex gap-1 overflow-x-auto border-b border-slate-200"
        >
          {TABS.map((t) => {
            const selected = tab === t.id
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => selectTab(t.id)}
                className={`min-h-[40px] shrink-0 border-b-2 px-3 py-2 text-sm font-semibold transition ${
                  selected
                    ? 'border-brand-900 text-brand-900'
                    : 'border-transparent text-slate-500 hover:text-brand-800'
                }`}
              >
                <span className="hidden sm:inline">{t.label}</span>
                <span className="sm:hidden">{t.short}</span>
              </button>
            )
          })}
        </div>

        {showFilters && (
          <div className="flex flex-col gap-2 sm:flex-row">
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
                className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none ring-brand-800/20 focus:ring-2"
              />
            </div>
            <select
              value={province}
              onChange={(e) => {
                setPage(1)
                setProvince(e.target.value)
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none ring-brand-800/20 focus:ring-2"
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
            <p className="text-sm text-slate-500">Loading intelligence…</p>
          </div>
        ) : error && !data ? (
          <ErrorPanel message={error} onRetry={load} />
        ) : (
          <div className="relative">
            {loading && data ? (
              <div className="pointer-events-none absolute inset-0 z-10 rounded-lg bg-white/50" />
            ) : null}
            {error && data ? (
              <div className="mb-4">
                <ErrorPanel message={error} onRetry={load} />
              </div>
            ) : null}

            {tab === 'overview' && data?.overview ? (
              <OverviewPanel overview={data.overview} dataNotes={data.dataNotes} />
            ) : null}
            {tab === 'overview' && !data?.overview ? (
              <ErrorPanel message="Overview data unavailable" onRetry={load} />
            ) : null}

            {tab === 'smes' ? (
              <SmeIntelligencePanel
                data={data?.smes}
                onSelect={openDetail}
                onPageChange={setPage}
              />
            ) : null}

            {tab === 'agents' ? (
              <AgentIntelligencePanel
                data={data?.agents}
                onSelect={openDetail}
                onPageChange={setPage}
              />
            ) : null}

            {tab === 'network' ? (
              <NetworkPanel network={data?.network} onSelect={openDetail} />
            ) : null}

            {tab === 'geography' ? <GeographyPanel geography={data?.geography} /> : null}

            {tab === 'actions' ? <ActionCentrePanel actions={data?.actions} /> : null}
          </div>
        )}
      </div>

      <UserDetailDrawer
        open={Boolean(selectedUid)}
        loading={detailLoading}
        detail={detail}
        onClose={closeDetail}
      />
    </FounderShell>
  )
}

export default function FounderUserIntelligencePage() {
  return (
    <Suspense fallback={<IntelligenceFallback />}>
      <FounderUserIntelligenceInner />
    </Suspense>
  )
}
