'use client'

import { useCallback, useEffect, useState } from 'react'
import type { OperationalIntelligence } from '@/lib/procurement/operationalIntelligence'
import { authFetch } from '@/lib/api/authenticatedFetch'

export function useOperationalIntelligence(pollMs = 60000) {
  const [data, setData] = useState<OperationalIntelligence | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const res = await authFetch('/api/operational/intelligence')
      const json = await res.json()
      if (json.success) setData(json.data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, pollMs)
    return () => clearInterval(interval)
  }, [refresh, pollMs])

  return { data, loading, refresh }
}
