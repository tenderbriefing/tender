'use client'

import { useCallback, useEffect, useState } from 'react'
import type { SyncStatus, TenderBriefing } from '@/lib/tenderBriefing/types'

interface UseTenderBriefingsOptions {
  pollIntervalMs?: number
  compulsoryOnly?: boolean
  enabled?: boolean
  pageSize?: number
  province?: string
  initialTenders?: TenderBriefing[]
  initialNextCursor?: string | null
  initialLastUpdated?: string | null
  initialSyncStatus?: Partial<SyncStatus>
  initialTotal?: number | null
}

export function useTenderBriefings(options: UseTenderBriefingsOptions = {}) {
  const {
    pollIntervalMs = 60000,
    compulsoryOnly = false,
    enabled = true,
    pageSize = 40,
    province = '',
    initialTenders,
    initialNextCursor = null,
    initialLastUpdated = null,
    initialSyncStatus = {},
    initialTotal = null,
  } = options

  const hasInitial = Array.isArray(initialTenders)
  const [tenders, setTenders] = useState<TenderBriefing[]>(initialTenders ?? [])
  const [loading, setLoading] = useState(!hasInitial)
  const [loadingMore, setLoadingMore] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<string | null>(initialLastUpdated)
  const [syncStatus, setSyncStatus] = useState<Partial<SyncStatus>>(initialSyncStatus)
  const [error, setError] = useState<string | null>(null)
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor)
  const [total, setTotal] = useState<number | null>(initialTotal)

  const fetchPage = useCallback(
    async (cursor?: string | null, replace = false) => {
      const params = new URLSearchParams()
      if (compulsoryOnly) params.set('compulsoryOnly', 'true')
      params.set('limit', String(pageSize))
      if (province) params.set('province', province)
      if (cursor) params.set('cursor', cursor)

      const tendersRes = await fetch(`/api/tender-briefings?${params.toString()}`)
      const tendersJson = await tendersRes.json()
      if (!tendersJson.success) {
        throw new Error(tendersJson.error || 'Failed to load tenders')
      }
      const page: TenderBriefing[] = tendersJson.data || []
      setTenders((prev) => {
        if (replace || !cursor) return page
        const seen = new Set(prev.map((t) => t.id))
        return [...prev, ...page.filter((t) => !seen.has(t.id))]
      })
      setNextCursor(tendersJson.nextCursor || null)
      if (typeof tendersJson.total === 'number') setTotal(tendersJson.total)
      setLastUpdated(tendersJson.lastUpdated || new Date().toISOString())
      setSyncStatus(tendersJson.syncStatus || {})
    },
    [compulsoryOnly, pageSize, province]
  )

  const fetchTenders = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      setError(null)
      try {
        await fetchPage(null, true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Network error')
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [fetchPage]
  )

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    setError(null)
    try {
      await fetchPage(nextCursor, false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setLoadingMore(false)
    }
  }, [fetchPage, loadingMore, nextCursor])

  useEffect(() => {
    if (!enabled) return
    fetchTenders()
  }, [enabled, fetchTenders])

  useEffect(() => {
    if (!enabled) return
    const interval = setInterval(() => fetchTenders(true), pollIntervalMs)
    return () => clearInterval(interval)
  }, [enabled, fetchTenders, pollIntervalMs])

  return {
    tenders,
    loading,
    loadingMore,
    error,
    lastUpdated,
    syncStatus,
    refresh: () => fetchTenders(true),
    loadMore,
    hasMore: Boolean(nextCursor),
    total,
  }
}

/** @deprecated Alias — prefer `useTenderBriefings` */
export const useTenderBriefingsPolling = useTenderBriefings
