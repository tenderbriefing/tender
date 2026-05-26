'use client'

import { useCallback, useEffect, useState } from 'react'
import type { SyncStatus, TenderBriefing } from '@/lib/tenderBriefing/types'

interface UseTenderBriefingsOptions {
  pollIntervalMs?: number
  compulsoryOnly?: boolean
  enabled?: boolean
}

export function useTenderBriefings(options: UseTenderBriefingsOptions = {}) {
  const {
    pollIntervalMs = 60000,
    compulsoryOnly = false,
    enabled = true,
  } = options

  const [tenders, setTenders] = useState<TenderBriefing[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [syncStatus, setSyncStatus] = useState<Partial<SyncStatus>>({})
  const [error, setError] = useState<string | null>(null)

  const fetchTenders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (compulsoryOnly) params.set('compulsoryOnly', 'true')

      const tendersRes = await fetch(`/api/tender-briefings?${params.toString()}`)
      const tendersJson = await tendersRes.json()

      if (tendersJson.success) {
        setTenders(tendersJson.data || [])
        setLastUpdated(tendersJson.lastUpdated || new Date().toISOString())
        setSyncStatus(tendersJson.syncStatus || {})
      } else {
        setError(tendersJson.error || 'Failed to load tenders')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [compulsoryOnly])

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
    error,
    lastUpdated,
    syncStatus,
    refresh: () => fetchTenders(true),
  }
}

/** @deprecated Alias — prefer `useTenderBriefings` */
export const useTenderBriefingsPolling = useTenderBriefings
