export interface TenderBriefingDocument {
  id?: string
  title?: string
  url?: string
  format?: string
  datePublished?: string
  extractedAt?: string
  textLength?: number
}

export interface TenderBriefingHistoryEntry {
  field: string
  from: unknown
  to: unknown
  changedAt: string
}

export interface TenderBriefingKeyDate {
  label: string
  date: string
  time?: string
}

export interface CalendarEvent {
  id: string
  type: 'briefing' | 'closing'
  title: string
  start: string | null
  end: string | null
  time?: string
  location: string
  compulsory: boolean
  tenderId: string
  ocid: string
  exportReady: boolean
  providers: {
    googleCalendar: string
    outlook: string
    ics: string
  }
}

export interface TenderBriefing {
  id: string
  ocid: string
  tenderNumber: string
  title: string
  description: string
  department: string
  buyer: string
  province: string
  category: string
  industrySector: string
  industryConfidence: number
  procurementMethod: string
  status: 'active' | 'closed' | 'cancelled'
  publishedDate: string
  closingDate: string
  briefingDate: string
  briefingTime: string
  briefingVenue: string
  briefingCompulsory: boolean
  briefingConfidence: number
  matchedBriefingTerms: string[]
  contactPerson: string
  contactEmail: string
  contactPhone: string
  meetingLink: string
  documents: TenderBriefingDocument[]
  detailUrl: string
  summary: string
  requirements: string[]
  risks: string[]
  keyDates: TenderBriefingKeyDate[]
  recommendedFor: string[]
  opportunityScore: number
  calendarEvents: CalendarEvent[]
  history: TenderBriefingHistoryEntry[]
  source: string
  visibility?: 'public' | 'private'
  ownerUid?: string
  originalEmailId?: string
  dispatchEligible?: boolean
  privateRfq?: boolean
  lastSyncedAt: string
  scrapedAt: string
  contentHash?: string
  deliveryLocation?: string
  aiProvider?: string
  provinceConfidence?: number
  gpsCoordinates?: string[]
}

export interface AttendanceRequest {
  id: string
  tenderId: string
  tenderTitle?: string
  smeId: string
  smeName?: string
  smeCompany?: string
  province?: string
  briefingVenue?: string
  briefingDate?: string
  briefingTime?: string
  status: 'pending' | 'assigned' | 'accepted' | 'completed' | 'cancelled'
  agentId?: string | null
  assignedAgentId?: string | null
  agentName?: string | null
  acceptedAt?: string | null
  assignedByAdmin?: boolean
  paymentStatus?:
    | 'pending'
    | 'paid'
    | 'failed'
    | 'cancelled'
    | 'refunded'
    | 'not_required'
  paymentAmount?: number | null
  quotedFee?: number | null
  currency?: string
  paymentProvider?: 'yoco' | 'manual' | 'none'
  paymentReference?: string | null
  yocoCheckoutId?: string | null
  yocoRedirectUrl?: string | null
  paidAt?: string | null
  paymentFailureReason?: string | null
  tenderNumber?: string
  department?: string
  smeEmail?: string
  smePhone?: string
  responsibilityAcknowledged?: boolean
  agentReliabilityScore?: number | null
  radiusKm?: number
  createdAt: string
  updatedAt: string
  notes?: string
  notifiedAgents?: string[]
  declines?: Array<{ agentId: string; reason: string; at: string }>
  reportId?: string
}

export interface BriefingReport {
  id: string
  requestId: string
  agentId: string
  tenderId: string
  summary: string
  audioUrl?: string
  attendanceProofUrl?: string
  documentUrls?: string[]
  notes?: string
  status: string
  createdAt: string
  attendanceConfirmed?: boolean
  arrivalTime?: string
  briefingStartedTime?: string
  keyInstructions?: string
  submissionRequirements?: string
  documentsCollected?: string
  questionsAsked?: string
  risksClarifications?: string
  photoUrls?: string[]
}

export interface OperationsNotification {
  id: string
  eventType: string
  userId?: string | null
  title?: string
  message?: string
  data?: Record<string, unknown>
  read: boolean
  createdAt: string
}

export interface SyncStatus {
  lastSuccessfulSync: string | null
  lastIncrementalSync: string | null
  lastFullReconciliation: string | null
  lastFailedSync?: string | null
  syncLogs: Array<Record<string, unknown>>
  isRunning: boolean
  lastError: string | null
  apiHealth: string
  scraperHealth: string
  tenderCount?: number
  compulsoryCount?: number
  lastUpdated?: string | null
  storageAdapter?: string
  lastFailedSyncAt?: string | null
  lastFailedSyncError?: string | null
  lastSuccessfulSyncProcessed?: number | null
  preservedTenderCount?: number
}

export interface AdminDashboardStats {
  totalBriefings: number
  compulsoryBriefings: number
  activeSmes: number
  activeYouthAgents: number
  smeAttendanceRequests: number
  acceptedBriefings: number
  pendingBriefings: number
  completedBriefingReports: number
  provincesRepresented: string[]
  topDepartments: Array<{ name: string; count: number }>
  closingWithin7Days: number
  syncStatus: SyncStatus
}
