'use client'

import { useCallback, useEffect, useState } from 'react'
import { authFetch } from '@/lib/api/authenticatedFetch'
import { usePageVisibleInterval } from '@/hooks/usePageVisibleInterval'
import type { SmeDashboardBootstrapData } from '@/lib/sme/dashboardBootstrapTypes'

export function useSmeDashboardBootstrap(enabled = true) {
  const [data, setData] = useState<SmeDashboardBootstrapData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (silent = false) => {
      if (!enabled) return
      if (!silent) setLoading(true)
      try {
        const res = await authFetch('/api/sme/dashboard/bootstrap')
        const json = await res.json()
        if (json.success) {
          setData(json.data)
          setError(null)
        } else {
          setError(json.error || 'Failed to load dashboard')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Network error')
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [enabled]
  )

  useEffect(() => {
    load()
  }, [load])

  usePageVisibleInterval(() => load(true), 60000, enabled)

  return { data, loading, error, refresh: () => load(true) }
}
