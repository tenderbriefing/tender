'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePagedList } from '@/hooks/usePagedList'
import { useRouter } from 'next/navigation'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import TenderTableSkeleton from '@/components/ui/TenderTableSkeleton'
import ProcurementEmptyState from '@/components/operations/ProcurementEmptyState'
import ProcurementPageHeader from '@/components/procurement/ProcurementPageHeader'
import { TrustStrip, ProcurementDisclaimer } from '@/components/procurement/TrustDisclaimer'
import TenderDashboardStats from '@/components/tenders/TenderDashboardStats'
import TenderFiltersBar from '@/components/tenders/TenderFiltersBar'
import TenderTable from '@/components/tenders/TenderTable'
import TenderOpportunityCard from '@/components/tenders/TenderOpportunityCard'
import { useTenderBriefingsPolling } from '@/hooks/useTenderBriefingsPolling'
import { useSavedProcurementFilters } from '@/hooks/useSavedProcurementFilters'
import { useAuth } from '@/components/providers/AuthProvider'
import {
  extractFilterOptions,
  filterTenders,
  sortTenders,
  type TenderSortKey,
} from '@/lib/procurement/filters'
import { computeTenderDashboardStats } from '@/lib/procurement/tenderStatus'
import { ArrowPathIcon, CheckCircleIcon, ExclamationTriangleIcon, FunnelIcon } from '@heroicons/react/24/outline'
import { toast } from 'react-hot-toast'

const PAGE_SIZE = 12

export default function TenderOpportunitiesPage() {
  const { user, userProfile } = useAuth()
  const router = useRouter()
  const { tenders, loading, lastUpdated, syncStatus, refresh } = useTenderBriefingsPolling({
    compulsoryOnly: false,
  })
  const { filters, setFilters, resetFilters, hydrated: filtersHydrated } =
    useSavedProcurementFilters()

  const [sortKey, setSortKey] = useState<TenderSortKey>('closingDate')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [refreshing, setRefreshing] = useState(false)

  const options = useMemo(() => extractFilterOptions(tenders), [tenders])
  const stats = useMemo(() => computeTenderDashboardStats(tenders), [tenders])

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
  } = usePagedList(filtered, PAGE_SIZE)

  useEffect(() => {
    resetPage()
  }, [filters, sortKey, sortDir, resetPage])

  const canRunSync = userProfile?.userType === 'admin'
  const ready = filtersHydrated

  const handleSort = (key: TenderSortKey) => {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const handleSortChange = (key: TenderSortKey, dir: 'asc' | 'desc') => {
    setSortKey(key)
    setSortDir(dir)
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
      toast.success('Tender opportunities updated', { id: 'sync' })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sync failed', { id: 'sync' })
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-brand-50/30">
      <Header />

      <div className="border-b border-slate-200/80 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <TrustStrip
            lastSync={lastUpdated}
            syncHealth={syncStatus?.apiHealth}
            isRunning={syncStatus?.isRunning}
          />
        </div>
      </div>

      <ProcurementPageHeader
        kicker="Procurement intelligence"
        title="Compulsory briefing opportunities"
        description="Every tender shown requires attendance at a compulsory briefing session. Filter by province and category, then request a verified Youth Agent if you cannot attend in person."
        meta={
          lastUpdated ? (
            <span className="text-sm text-slate-500">
              Last sync: {new Date(lastUpdated).toLocaleString('en-ZA')}
            </span>
          ) : null
        }
        actions={
          <>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
              <CheckCircleIcon className="h-4 w-4" aria-hidden />
              Live data
            </span>
            {canRunSync && (
              <button
                type="button"
                onClick={handleSync}
                disabled={refreshing}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-brand-800 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
              >
                <ArrowPathIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden />
                Sync now
              </button>
            )}
          </>
        }
      />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {!user && tenders.length > 0 && (
          <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-accent-200 bg-accent-50/80 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-brand-900">
              Browse opportunities publicly. Sign in as an SME to request Youth Agent briefing
              attendance.
            </p>
            <button
              type="button"
              onClick={() => router.push('/auth/signin')}
              className="shrink-0 min-h-[44px] rounded-xl bg-brand-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Sign in
            </button>
          </div>
        )}

        {tenders.length === 0 && !loading && (
          <div className="mb-6 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <ExclamationTriangleIcon className="h-5 w-5 shrink-0 text-amber-700" aria-hidden />
            <p className="text-sm text-amber-900">
              No tender opportunities loaded yet. An administrator can run a sync from the admin
              dashboard.
            </p>
          </div>
        )}

        <div className="mb-6">
          <TenderDashboardStats
            total={stats.total}
            open={stats.open}
            closingSoon={stats.closingSoon}
            compulsory={stats.compulsory}
          />
        </div>

        {ready && (
          <div className="mb-6">
            <TenderFiltersBar
              filters={filters}
              onChange={setFilters}
              onReset={resetFilters}
              sortKey={sortKey}
              sortDir={sortDir}
              onSortChange={handleSortChange}
              options={options}
              resultCount={filtered.length}
            />
          </div>
        )}

        {!ready || loading ? (
          <TenderTableSkeleton rows={PAGE_SIZE} />
        ) : filtered.length === 0 ? (
          <div>
            <ProcurementEmptyState
              icon={FunnelIcon}
              title="No opportunities match your filters"
              description="Try clearing filters or broadening your province and department selection."
            />
            <div className="-mt-6 pb-8 text-center">
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex min-h-[44px] items-center rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Clear all filters
              </button>
            </div>
          </div>
        ) : (
          <>
            <TenderTable
              tenders={pagedTenders}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={handleSort}
            />

            <div className="mt-4 space-y-4 md:hidden">
              {pagedTenders.map((tender) => (
                <TenderOpportunityCard key={tender.id} tender={tender} />
              ))}
            </div>

            {totalPages > 1 && (
              <nav
                className="mt-8 flex flex-col items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:flex-row"
                aria-label="Pagination"
              >
                <p className="text-sm text-slate-600">
                  Showing{' '}
                  <span className="font-semibold text-slate-900">
                    {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)}
                  </span>{' '}
                  of <span className="font-semibold text-slate-900">{total}</span>
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={!hasPrev}
                    onClick={goPrev}
                    className="min-h-[44px] rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <span className="flex min-h-[44px] items-center px-2 text-sm font-medium text-slate-600">
                    {page + 1} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={!hasNext}
                    onClick={goNext}
                    className="min-h-[44px] rounded-xl bg-brand-800 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </nav>
            )}
          </>
        )}

        <div className="mt-10">
          <ProcurementDisclaimer />
        </div>
      </main>

      <Footer />
    </div>
  )
}
