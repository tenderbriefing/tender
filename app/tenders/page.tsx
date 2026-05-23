'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePagedList } from '@/hooks/usePagedList'
import { useRouter } from 'next/navigation'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import TenderTableSkeleton from '@/components/ui/TenderTableSkeleton'
import ProcurementFiltersPanel from '@/components/procurement/ProcurementFiltersPanel'
import TenderOpportunitiesView from '@/components/procurement/TenderOpportunitiesView'
import { TrustStrip, ProcurementDisclaimer } from '@/components/procurement/TrustDisclaimer'
import { useTenderBriefingsPolling } from '@/hooks/useTenderBriefingsPolling'
import { useAuth } from '@/components/providers/AuthProvider'
import {
  defaultProcurementFilters,
  extractFilterOptions,
  filterTenders,
  sortTenders,
  type ProcurementFilterState,
  type TenderSortKey,
} from '@/lib/procurement/filters'
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import { toast } from 'react-hot-toast'

export default function TenderOpportunitiesPage() {
  const { user, userProfile } = useAuth()
  const router = useRouter()
  const { tenders, loading, lastUpdated, syncStatus, refresh } = useTenderBriefingsPolling({
    compulsoryOnly: false,
  })

  const [filters, setFilters] = useState<ProcurementFilterState>(defaultProcurementFilters)
  const [sortKey, setSortKey] = useState<TenderSortKey>('closingDate')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [refreshing, setRefreshing] = useState(false)

  const options = useMemo(() => extractFilterOptions(tenders), [tenders])

  const filtered = useMemo(() => {
    const f = filterTenders(tenders, filters)
    return sortTenders(f, sortKey, sortDir)
  }, [tenders, filters, sortKey, sortDir])

  const {
    pageItems: pagedTenders,
    page,
    totalPages,
    total,
    goNext,
    goPrev,
    hasNext,
    hasPrev,
    reset: resetPage,
  } = usePagedList(filtered, 50)

  useEffect(() => {
    resetPage()
  }, [filters, sortKey, sortDir, resetPage])

  const compulsoryCount = tenders.filter((t) => t.briefingCompulsory).length
  const canRunSync = userProfile?.userType === 'admin'

  const handleSort = (key: TenderSortKey) => {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const handleSync = async () => {
    if (!user) {
      router.push('/auth/signin')
      return
    }
    setRefreshing(true)
    toast.loading('Running procurement data sync…', { id: 'sync' })
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (userProfile?.userType === 'admin') {
        const token = await user.getIdToken()
        headers.Authorization = `Bearer ${token}`
        const res = await fetch('/api/admin/sync-run', {
          method: 'POST',
          headers,
          body: JSON.stringify({ force: true }),
        })
        const json = await res.json()
        if (!json.success) throw new Error(json.error || 'Sync failed')
      } else {
        await fetch('/api/sync/run', { method: 'POST', headers })
      }
      await refresh()
      toast.success('Tender opportunities updated from official data', { id: 'sync' })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sync failed', { id: 'sync' })
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <TrustStrip />
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-brand-700 uppercase tracking-wide">
              Official procurement data
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
              Tender Opportunities
            </h1>
            <p className="mt-2 text-slate-600 text-sm sm:text-base max-w-3xl">
              Browse live government tender opportunities in a familiar eTenders-style layout.
              Track compulsory briefing sessions, closing dates, and request Youth Agent
              attendance support.
            </p>
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              <span className="rounded-full bg-white border border-slate-200 px-3 py-1 font-medium text-slate-800">
                {filtered.length} of {tenders.length} opportunities
              </span>
              <span className="rounded-full bg-amber-50 border border-amber-200 px-3 py-1 font-medium text-amber-900">
                {compulsoryCount} compulsory briefings
              </span>
              {syncStatus?.isRunning ? (
                <span className="inline-flex items-center gap-1 text-brand-700">
                  <ArrowPathIcon className="h-4 w-4 animate-spin" />
                  Sync in progress
                </span>
              ) : lastUpdated ? (
                <span className="text-slate-500">
                  Last sync: {new Date(lastUpdated).toLocaleString('en-ZA')}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-800">
              <CheckCircleIcon className="h-4 w-4" />
              Live data
            </span>
            {canRunSync && (
              <button
                type="button"
                onClick={handleSync}
                disabled={refreshing}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                <ArrowPathIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                Sync now
              </button>
            )}
          </div>
        </div>

        {!user && tenders.length > 0 && (
          <div className="mb-6 flex flex-col gap-3 rounded-xl border border-brand-100 bg-brand-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-brand-900">
              Public browsing is available. Sign in as an SME to request Youth Agent attendance
              for compulsory briefing sessions.
            </p>
            <button
              type="button"
              onClick={() => router.push('/auth/signin')}
              className="shrink-0 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Sign in
            </button>
          </div>
        )}

        {tenders.length === 0 && !loading && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 flex gap-3">
            <ExclamationTriangleIcon className="h-5 w-5 text-amber-700 shrink-0" />
            <p className="text-sm text-amber-900">
              No tender opportunities loaded yet. An administrator can run a sync from the admin
              dashboard.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-3">
            <ProcurementFiltersPanel
              filters={filters}
              onChange={setFilters}
              options={options}
              resultCount={filtered.length}
            />
          </div>

          <div className="lg:col-span-9">
            {loading ? (
              <TenderTableSkeleton />
            ) : filtered.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
                <p className="text-slate-600">No tender opportunities match your filters.</p>
                <button
                  type="button"
                  onClick={() => setFilters({ ...defaultProcurementFilters })}
                  className="mt-4 text-sm font-semibold text-brand-700"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <>
                <TenderOpportunitiesView
                  tenders={pagedTenders}
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                />
                {totalPages > 1 && (
                  <div className="mt-6 flex flex-col items-center justify-between gap-3 sm:flex-row">
                    <p className="text-sm text-slate-600">
                      Showing {page * 50 + 1}–{Math.min((page + 1) * 50, total)} of {total}{' '}
                      opportunities
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={!hasPrev}
                        onClick={goPrev}
                        className="min-h-[44px] rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold disabled:opacity-40"
                      >
                        Previous
                      </button>
                      <span className="flex min-h-[44px] items-center px-2 text-sm text-slate-600">
                        Page {page + 1} / {totalPages}
                      </span>
                      <button
                        type="button"
                        disabled={!hasNext}
                        onClick={goNext}
                        className="min-h-[44px] rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="mt-10">
          <ProcurementDisclaimer />
        </div>
      </main>

      <Footer />
    </div>
  )
}
