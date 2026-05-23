import type {
  AttendanceRequest,
  BriefingReport,
  TenderBriefing,
} from '@/lib/tenderBriefing/types'

export interface SyncRunOptions {
  force?: boolean
  fullReconciliation?: boolean
}

export interface SyncRunResult {
  success: boolean
  processed?: number
  skipped?: boolean
  error?: string
  preservedTenderCount?: number
  [key: string]: unknown
}

export interface IncrementalSyncService {
  runSync: (options?: SyncRunOptions) => Promise<SyncRunResult>
  getSyncStatus: () => Promise<Record<string, unknown>>
}

export interface StorageAdapter {
  adapterType?: string
  getTenderBriefings: (filters?: Record<string, unknown>) => Promise<TenderBriefing[]>
  getTenderBriefingById: (id: string) => Promise<TenderBriefing | null>
  getSyncState: () => Promise<Record<string, unknown>>
  getAttendanceRequests: (
    filters?: Record<string, unknown>
  ) => Promise<AttendanceRequest[]>
  getBriefingReports: (filters?: Record<string, unknown>) => Promise<BriefingReport[]>
  getAuditLogs?: (filters?: Record<string, unknown>) => Promise<unknown[]>
  getNotifications?: (filters?: {
    userId?: string
    limit?: number
  }) => Promise<Record<string, unknown>[]>
  markNotificationRead?: (notificationId: string) => Promise<void>
  markAllNotificationsRead?: (userId: string) => Promise<void>
}

export interface StorageAdapterModule {
  getStorage: () => StorageAdapter
}

export interface AgentAssignmentService {
  createRequest: (
    payload: Record<string, unknown>,
    agents?: unknown[]
  ) => Promise<{ request: AttendanceRequest; nearbyAgents?: unknown[] }>
  getRequestById: (requestId: string) => Promise<AttendanceRequest | null>
  acceptRequest: (
    requestId: string,
    agent: Record<string, unknown>
  ) => Promise<AttendanceRequest>
  assignRequestToAgent: (
    requestId: string,
    agent: Record<string, unknown>,
    options?: { byAdmin?: boolean }
  ) => Promise<AttendanceRequest>
  declineRequest: (
    requestId: string,
    agentId: string,
    reason: string
  ) => Promise<AttendanceRequest>
  listOpportunitiesForAgent: (
    agentId: string,
    agentProvince?: string
  ) => Promise<AttendanceRequest[]>
  submitBriefingReport: (payload: Record<string, unknown>) => Promise<BriefingReport>
}

export interface AuditLogService {
  getAuditLogs: (filters?: Record<string, unknown>) => Promise<unknown[]>
  logEvent: (event: Record<string, unknown>) => Promise<unknown>
}

export interface CalendarService {
  getAllCalendarEvents: (tenders: unknown[]) => unknown[]
  buildCalendarEvents?: (tender: unknown) => unknown[]
}

export interface UsersService {
  getYouthAgents: () => Promise<Record<string, unknown>[]>
  getUserById: (id: string) => Promise<Record<string, unknown> | null>
  upsertSmeProfile: (profile: Record<string, unknown>) => Promise<unknown>
  upsertAgentProfile: (profile: Record<string, unknown>) => Promise<unknown>
}
