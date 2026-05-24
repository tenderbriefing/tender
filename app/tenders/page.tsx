'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePagedList } from '@/hooks/usePagedList'
import { useRouter } from 'next/navigation'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import TenderTableSkeleton from '@/components/ui/TenderTableSkeleton'
import ProcurementFiltersPanel from '@/components/procurement/ProcurementFiltersPanel'
import TenderOpportunitiesView from '@/components/procurement/TenderOpportunitiesView'
import ProcurementEmptyState from '@/components/operations/ProcurementEmptyState'
import ProcurementPageHeader from '@/components/procurement/ProcurementPageHeader'
import OperationalIntelligencePanel from '@/components/procurement/OperationalIntelligencePanel'
import QuickProvinceFilters from '@/components/procurement/QuickProvinceFilters'
import TenderTableToolbar from '@/components/procurement/TenderTableToolbar'
import { TrustStrip, ProcurementDisclaimer } from '@/components/procurement/TrustDisclaimer'
import { useTenderBriefingsPolling } from '@/hooks/useTenderBriefingsPolling'
import { useSavedProcurementFilters } from '@/hooks/useSavedProcurementFilters'
import { useColumnVisibility } from '@/hooks/useColumnVisibility'
import { useOperationalIntelligence } from '@/hooks/useOperationalIntelligence'
import { useAuth } from '@/components/providers/AuthProvider'
import {
  extractFilterOptions,
  filterTenders,
  sortTenders,
  type TenderSortKey,
} from '@/lib/procurement/filters'
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline'
import { toast } from 'react-hot-toast'

export default function TenderOpportunitiesPage() {
  const { user, userProfile } = useAuth()
  const router = useRouter()
  const { tenders, loading, lastUpdated, syncStatus, refresh } = useTenderBriefingsPolling({
    compulsoryOnly: false,
  })
  const { filters, setFilters, resetFilters, hydrated: filtersHydrated } =
    useSavedProcurementFilters()
  const { visibleColumns, toggleColumn, resetColumns, hydrated: columnsHydrated } =
    useColumnVisibility()
  const { data: intelligence, loading: intelligenceLoading } = useOperationalIntelligence()

  const [sortKey, setSortKey] = useState<TenderSortKey>('closingDate')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [refreshing, setRefreshing] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)

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
  const ready = filtersHydrated && columnsHydrated

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
    <div className="procurement-shell">
      <Header />

      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <TrustStrip
            lastSync={intelligence?.lastSync || lastUpdated}
            syncHealth={intelligence?.syncHealth || syncStatus?.apiHealth}
            isRunning={intelligence?.isSyncRunning || syncStatus?.isRunning}
          />
        </div>
      </div>

      <ProcurementPageHeader
        kicker="Official procurement data"
        title="Tender opportunities"
        description="Browse live government tender opportunities in a familiar eTenders-style layout. Track compulsory briefing sessions, closing dates, and request Youth Agent attendance support."
        meta={
          <>
            <span className="procurement-stat-chip">
              {filtered.length} of {tenders.length} opportunities
            </span>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-sm font-medium text-amber-900">
              {compulsoryCount} compulsory briefings
            </span>
            {syncStatus?.isRunning ? (
              <span className="inline-flex items-center gap-1 text-sm font-medium text-brand-700">
                <ArrowPathIcon className="h-4 w-4 animate-spin" aria-hidden />
                Sync in progress
              </span>
            ) : lastUpdated ? (
              <span className="text-sm text-slate-500">
                Last sync: {new Date(lastUpdated).toLocaleString('en-ZA')}
              </span>
            ) : null}
          </>
        }
        actions={
          <>
            <span className="inline-flex items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-800">
              <CheckCircleIcon className="h-4 w-4" aria-hidden />
              Live data
            </span>
            {canRunSync && (
              <button
                type="button"
                onClick={handleSync}
                disabled={refreshing}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                <ArrowPathIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden />
                Sync now
              </button>
            )}
          </>
        }
      />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6">
          <OperationalIntelligencePanel
            data={intelligence}
            loading={intelligenceLoading}
            compact
          />
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
              className="shrink-0 min-h-[44px] rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Sign in
            </button>
          </div>
        )}

        {tenders.length === 0 && !loading && (
          <div className="mb-6 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <ExclamationTriangleIcon className="h-5 w-5 shrink-0 text-amber-700" aria-hidden />
            <p className="text-sm text-amber-900">
              No tender opportunities loaded yet. An administrator can run a sync from the admin
              dashboard.
            </p>
          </div>
        )}

        <div className="mb-4 lg:hidden">
          <button
            type="button"
            onClick={() => setFiltersOpen(!filtersOpen)}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-800"
            aria-expanded={filtersOpen}
          >
            <FunnelIcon className="h-4 w-4" aria-hidden />
            {filtersOpen ? 'Hide filters' : 'Show filters'}
          </button>
        </div>

        <div className="mb-4">
          <QuickProvinceFilters
            activeProvince={filters.province}
            onSelect={(province) => setFilters({ ...filters, province })}
            availableProvinces={options.provinces}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className={`lg:col-span-3 ${filtersOpen ? 'block' : 'hidden lg:block'}`}>
            <ProcurementFiltersPanel
              filters={filters}
              onChange={setFilters}
              options={options}
              resultCount={filtered.length}
            />
          </div>

          <div className="lg:col-span-9">
            {!ready || loading ? (
              <TenderTableSkeleton />
            ) : filtered.length === 0 ? (
              <div>
                <ProcurementEmptyState
                  icon={FunnelIcon}
                  title="No opportunities match your filters"
                  description="Adjust province, department, or briefing filters to see more official tender listings."
                />
                <div className="-mt-6 pb-8 text-center">
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="inline-flex min-h-[44px] items-center rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
                  >
                    Clear all filters
                  </button>
                </div>
              </div>
            ) : (
              <>
                <TenderTableToolbar
                  visibleColumns={visibleColumns}
                  onToggleColumn={toggleColumn}
                  onResetColumns={resetColumns}
                  resultCount={filtered.length}
                />
                <TenderOpportunitiesView
                  tenders={pagedTenders}
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                  visibleColumns={visibleColumns}
                />
                {totalPages > 1 && (
                  <nav
                    className="mt-6 flex flex-col items-center justify-between gap-3 sm:flex-row"
                    aria-label="Pagination"
                  >
                    <p className="text-sm text-slate-600">
                      Showing {page * 50 + 1}–{Math.min((page + 1) * 50, total)} of {total}{' '}
                      opportunities
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={!hasPrev}
                        onClick={goPrev}
                        className="min-h-[44px] rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600"
                        aria-label="Previous page"
                      >
                        Previous
                      </button>
                      <span
                        className="flex min-h-[44px] items-center px-2 text-sm text-slate-600"
                        aria-live="polite"
                      >
                        Page {page + 1} / {totalPages}
                      </span>
                      <button
                        type="button"
                        disabled={!hasNext}
                        onClick={goNext}
                        className="min-h-[44px] rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600"
                        aria-label="Next page"
                      >
                        Next
                      </button>
                    </div>
                  </nav>
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
