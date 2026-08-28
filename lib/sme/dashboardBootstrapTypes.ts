import type { SmeDashboardMetrics } from '@/hooks/useDashboardMetrics'
import type { SmeWorkspaceView } from '@/lib/sme/workspaceTypes'

export interface DashboardActivityItem {
  id: string
  type: string
  title: string
  description: string
  createdAt: string
  href?: string
  status: string
}

export interface SmeDashboardBootstrapData {
  metrics: SmeDashboardMetrics
  workspace: SmeWorkspaceView & { attendanceRequests: number }
  recentActivities: DashboardActivityItem[]
}
