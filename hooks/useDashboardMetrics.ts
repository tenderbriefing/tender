'use client'

import { useCallback, useEffect, useState } from 'react'
import { authFetch } from '@/lib/api/authenticatedFetch'

export interface SmeDashboardMetrics {
  role: 'sme'
  activeOpportunities: number
  attendanceRequests: number
  upcomingBriefings: number
  closingSoon: number
  completedReports: number
  pendingAttendance: number
}

export interface AgentDashboardMetrics {
  role: 'youth-agent'
  availableAssignments: number
  assignedBriefings: number
  completedReports: number
  reliabilityScore: number
  missedBriefings: number
  acceptedBriefings: number
}

export interface AdminDashboardMetrics {
  role: 'admin'
  totalTenders: number
  compulsoryBriefings: number
  pendingRequests: number
  assignedBriefings: number
  completedReports: number
  activeAgents: number
  activeSmes: number
  closingSoon: number
  syncHealth: string
  schedulerHealth: string
  lastSuccessfulSync?: string | null
}

export type DashboardMetrics =
  | SmeDashboardMetrics
  | AgentDashboardMetrics
  | AdminDashboardMetrics

export function useDashboardMetrics(enabled = true) {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (silent = false) => {
    if (!enabled) return
    if (!silent) setLoading(true)
    try {
      const res = await authFetch('/api/dashboard/metrics')
      const json = await res.json()
      if (json.success) {
        setMetrics(json.data)
        setError(null)
      } else {
        setError(json.error || 'Failed to load metrics')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    load()
    const interval = setInterval(() => load(true), 60000)
    return () => clearInterval(interval)
  }, [load])

  return { metrics, loading, error, refresh: () => load(true) }
}
