import type { EngagementClass } from '@/lib/founder/engagement'

export type IntelligenceTab =
  | 'overview'
  | 'smes'
  | 'agents'
  | 'network'
  | 'geography'
  | 'actions'

export type EngagementCounts = Partial<Record<EngagementClass | string, number>>

export interface OverviewData {
  totalRegistered: number
  totalSmes: number
  totalYouthAgents: number
  newSmesToday: number
  newYouthAgentsToday: number
  activeSmesToday: number
  activeYouthAgentsToday: number
  inactiveUsers: number
  averageDaysOnPlatform?: { all?: number | null; smes?: number | null; agents?: number | null }
  averageSessionDuration?: string | null
  registrationCompletionRate?: { smes?: number | null; agents?: number | null }
  comparisons?: { note?: string }
  engagementDistribution?: {
    smes?: EngagementCounts
    agents?: EngagementCounts
  }
}

export interface SmeRow {
  id: string
  companyName?: string | null
  displayName?: string | null
  email?: string | null
  province?: string | null
  city?: string | null
  engagement: EngagementClass | string
  tendersSaved?: number
  tendersTracked?: number
  attendanceRequests?: number
  assignedAgentCount?: number
  registeredAt?: string | null
  daysOnPlatform?: number | null
}

export interface AgentRow {
  id: string
  displayName?: string | null
  email?: string | null
  province?: string | null
  agentStatus?: string | null
  engagement: EngagementClass | string
  assignedSmeCount?: number
  completedBriefingCount?: number
  acceptedBriefingCount?: number
  reliabilityScore?: number | null
  registeredAt?: string | null
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface NetworkData {
  smesWithoutAgents?: number
  agentsWithoutSmes?: number
  pairs?: Array<{
    requestId: string
    smeId: string
    agentId: string
    status?: string
    createdAt?: string | null
  }>
}

export interface GeographyRow {
  province: string
  smes: number
  agents: number
  ratio: number | null
  unassignedSmes: number
}

export interface ActionItem {
  id: string
  audience: string
  priority: 'high' | 'medium' | 'low' | string
  title: string
  why: string
  suggestedAction: string
  affectedCount: number
}

export interface IntelligencePayload {
  overview?: OverviewData
  smes?: Paginated<SmeRow>
  agents?: Paginated<AgentRow>
  network?: NetworkData
  geography?: GeographyRow[]
  actions?: ActionItem[]
  dataNotes?: string[]
  generatedAt?: string
}

export interface UserDetailPayload {
  user: {
    userType?: string
    companyName?: string | null
    displayName?: string | null
    email?: string | null
    province?: string | null
    city?: string | null
  }
  summary?: {
    lastMeaningfulAt?: string | null
    meaningfulEventCount?: number
    sessionCount?: number
  } | null
  timeline?: Array<{
    eventId?: string
    eventName?: string
    timestamp?: string
    pagePath?: string
  }>
  attendanceRequests?: Array<{ id: string; status?: string }>
}
