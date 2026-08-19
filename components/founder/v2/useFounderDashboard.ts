'use client'

import { useCallback, useEffect, useState } from 'react'
import { authFetch } from '@/lib/api/authenticatedFetch'
import type { FounderDashboardPayload } from '@/lib/founder/dashboard'

export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export function useFounderDashboard(params: Record<string, string | number>) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<FounderDashboardPayload | null>(null)
  const qs = new URLSearchParams(
    Object.fromEntries(
      Object.entries(params).map(([k, v]) => [k, String(v)])
    )
  ).toString()

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await authFetch(`/api/founder/dashboard?${qs}`)
      const json = await res.json()
      if (res.status === 401) {
        throw new Error(json.error || 'Sign in required')
      }
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to load founder dashboard')
      }
      setData(json.data as FounderDashboardPayload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [qs])

  useEffect(() => {
    load()
  }, [load])

  return { loading, error, data, reload: load }
}
