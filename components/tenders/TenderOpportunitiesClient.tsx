'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import TenderTableSkeleton from '@/components/ui/TenderTableSkeleton'
import ProcurementEmptyState from '@/components/operations/ProcurementEmptyState'
import ProcurementPageHeader from '@/components/procurement/ProcurementPageHeader'
import { TrustStrip } from '@/components/procurement/TrustDisclaimer'
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
import type { ReactNode } from 'react'
import type { CataloguePageResult } from '@/lib/seo/catalogueServerData'
import { ArrowPathIcon, CheckCircleIcon } from '@heroicons/react/24/outline'
import { ClipboardList, Filter } from 'lucide-react'
import { toast } from 'react-hot-toast'

const SKELETON_ROWS = 12
const COMPULSORY_ONLY = false

type CatalogueDashboardStats = {
  total: number
  open: number
  closingSoon: number
  compulsory: number
}

interface TenderOpportunitiesClientProps {
  initial: CataloguePageResult
  ssrFallbackId?: string
  ssrList?: ReactNode
}

export default function TenderOpportunitiesClient({
  initial,
  ssrFallbackId = 'tender-catalogue-ssr',
  ssrList,
}: TenderOpportunitiesClientProps) {
  const { user, userProfile } = useAuth()
  const router = useRouter()
  const { filters, setFilters, resetFilters, hydrated: filtersHydrated } =
    useSavedProcurementFilters()
  const { tenders, loading, loadingMore, error, lastUpdated, syncStatus, refresh, loadMore, hasMore } =
    useTenderBriefingsPolling({
      compulsoryOnly: COMPULSORY_ONLY,
      province: filters.province || undefined,
      pageSize: 40,
      initialTenders: initial.tenders,
      initialNextCursor: initial.nextCursor,
      initialLastUpdated: initial.lastUpdated,
    })

  const [sortKey, setSortKey] = useState<TenderSortKey>('closingDate')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [refreshing, setRefreshing] = useState(false)
  const [catalogueStats, setCatalogueStats] = useState<CatalogueDashboardStats | null>(null)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(true)
    const el = document.getElementById(ssrFallbackId)
    if (el) el.setAttribute('hidden', 'hidden')
  }, [ssrFallbackId])

  const options = useMemo(() => extractFilterOptions(tenders), [tenders])

  const filtered = useMemo(() => {
    const f = filterTenders(tenders, filters)
    return sortTenders(f, sortKey, sortDir)
  }, [tenders, filters, sortKey, sortDir])

  useEffect(() => {
    let cancelled = false
    fetch('/api/tender-briefings/stats/summary')
      .then((res) => res.json())
      .then((json) => {
        if (cancelled || !json?.success || !json.data) return
        const d = json.data as {
          totalBriefings?: number
          compulsoryBriefings?: number
          closingWithin7Days?: number
        }
        setCatalogueStats({
          total: Number(d.totalBriefings || 0),
          open: Number(d.totalBriefings || 0),
          closingSoon: Number(d.closingWithin7Days || 0),
          compulsory: Number(d.compulsoryBriefings || 0),
        })
      })
      .catch(() => {
        if (!cancelled) setCatalogueStats(null)
      })
    return () => {
      cancelled = true
    }
  }, [lastUpdated])

  const canRunSync = userProfile?.userType === 'admin'
  const ready = filtersHydrated
  const hasData = tenders.length > 0
  const isEmptyCatalog = !loading && !hasData && !error

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
        title={
          COMPULSORY_ONLY
            ? 'Compulsory briefing opportunities'
            : 'Tender briefing opportunities'
        }
        description={
          COMPULSORY_ONLY
            ? 'Every tender shown requires attendance at a compulsory briefing session. Filter by province and category, then request a verified Youth Agent if you cannot attend in person.'
            : 'Browse live government tenders with briefing dates and details highlighted. Filter by province and category, then request a verified Youth Agent when a compulsory session needs attendance support.'
        }
        meta={
          lastUpdated ? (
            <span className="text-sm text-slate-500">
              Last sync:{' '}
              {new Date(lastUpdated).toLocaleString('en-ZA', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'Africa/Johannesburg',
              })}
            </span>
          ) : null
        }
        actions={
          <>
            {hasData ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-800">
                <CheckCircleIcon className="h-4 w-4 text-accent-600" aria-hidden />
                Live data
              </span>
            ) : !loading ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-500">
                Awaiting sync
              </span>
            ) : null}
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
        {ssrList}
        {!user && hasData && (
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

        {catalogueStats && (
          <div className="mb-6">
            <TenderDashboardStats
              total={catalogueStats.total}
              open={catalogueStats.open}
              closingSoon={catalogueStats.closingSoon}
              compulsory={catalogueStats.compulsory}
            />
          </div>
        )}

        {ready && hasData && (
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

        {error && !loading && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {!ready || (loading && !hasData) ? (
          <TenderTableSkeleton rows={SKELETON_ROWS} />
        ) : isEmptyCatalog ? (
          <ProcurementEmptyState
            icon={ClipboardList}
            title="No tender opportunities loaded yet"
            description="Listings appear here after official eTenders data syncs. Create a free account to get started, or check back shortly — an administrator can refresh the feed from the dashboard."
            actionLabel="Start free"
            actionHref="/auth/role-selection"
          />
        ) : filtered.length === 0 ? (
          <div>
            <ProcurementEmptyState
              icon={Filter}
              title="No opportunities match your filters"
              description={
                hasMore
                  ? 'Filters apply to the opportunities loaded so far. Load more from the catalogue, or clear filters to broaden province and department selection.'
                  : 'Try clearing filters or broadening your province and department selection.'
              }
            />
            <div className="-mt-6 flex flex-col items-center gap-3 pb-8">
              {hasMore && (
                <button
                  type="button"
                  onClick={() => loadMore()}
                  disabled={loadingMore}
                  className="inline-flex min-h-[44px] items-center rounded-xl bg-brand-800 px-5 py-2.5 text-sm font-semibold text-white shadow-soft hover:bg-brand-700 disabled:opacity-50"
                >
                  {loadingMore ? 'Loading…' : 'Load more opportunities'}
                </button>
              )}
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex min-h-[44px] items-center rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Clear all filters
              </button>
            </div>
          </div>
        ) : (
          <div className={hydrated ? undefined : 'hidden'} aria-hidden={!hydrated}>
            <TenderTable
              tenders={filtered}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={handleSort}
            />

            <div className="mt-4 space-y-4 md:hidden">
              {filtered.map((tender) => (
                <TenderOpportunityCard key={tender.id} tender={tender} />
              ))}
            </div>

            <nav
              className="mt-8 flex flex-col items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:flex-row"
              aria-label="Catalogue pagination"
            >
              <p className="text-sm text-slate-600">
                Showing{' '}
                <span className="font-semibold text-slate-900">{filtered.length}</span>
                {tenders.length !== filtered.length ? (
                  <>
                    {' '}
                    matching of{' '}
                    <span className="font-semibold text-slate-900">{tenders.length}</span> loaded
                  </>
                ) : (
                  <> loaded</>
                )}
                {catalogueStats ? (
                  <> · catalogue totals above are platform aggregates, not this page</>
                ) : null}
              </p>
              {hasMore ? (
                <button
                  type="button"
                  onClick={() => loadMore()}
                  disabled={loadingMore}
                  className="min-h-[44px] rounded-xl bg-brand-800 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-40"
                >
                  {loadingMore ? 'Loading…' : 'Load more'}
                </button>
              ) : (
                <span className="text-sm font-medium text-slate-500">End of loaded catalogue</span>
              )}
            </nav>
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
