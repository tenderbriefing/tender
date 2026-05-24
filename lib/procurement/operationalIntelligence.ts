export interface OperationalIntelligence {
  lastSync: string | null
  syncHealth: string
  firestoreHealth: 'healthy' | 'degraded' | 'unknown'
  isSyncRunning: boolean
  newTendersLast15Min: number
  briefingsToday: number
  briefingsThisWeek: number
  compulsoryBriefings: number
  closingSoon: number
  highDemandProvinces: Array<{ province: string; requestCount: number }>
  mostRequestedBriefings: Array<{
    tenderId: string
    tenderTitle?: string
    requestCount: number
  }>
  averageAgentResponseMinutes: number | null
  totalActiveTenders: number
  pendingAttendanceRequests: number
}

export interface UseOperationalIntelligenceResult {
  data: OperationalIntelligence | null
  loading: boolean
  refresh: () => Promise<void>
}
