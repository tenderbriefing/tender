export type ReportStatus =
  | 'awaiting_evidence'
  | 'evidence_uploaded'
  | 'processing'
  | 'draft_report'
  | 'agent_review'
  | 'final'
  | 'delivered'
  | 'processing_failed'

// Evidence status + content for Tender Briefing Intelligence Reports.
export interface BriefingIntelligenceReport {
  // Firestore doc ID
  id: string
  // TB-BR-XXXXXX report code
  reportId: string

  // attendanceRequest reference
  requestId: string

  // Tender reference
  tenderId: string

  // Ownership / authorization
  agentId: string
  smeId: string

  status: ReportStatus

  // Timestamps for SLA
  evidenceSubmittedAt: string | null
  processingStartedAt: string | null
  draftReadyAt: string | null
  agentReviewedAt: string | null
  finalizedAt: string | null
  deliveredAt: string | null
  slaDeadline: string | null // evidenceSubmittedAt + 24h
  slaBreached: boolean

  // Evidence references
  audioFileRef: string | null // Storage path
  audioFileName: string | null
  audioFileSizeMb: number | null
  attendanceEvidenceRefs: string[] // Storage paths

  // Agent observations (structured)
  agentObservations: {
    arrivalTime: string | null
    briefingStartTime: string | null
    briefingEndTime: string | null
    approxAttendees: number | null
    siteInspection: boolean | null
    docsDistributed: boolean | null
    importantAnnouncement: boolean | null
    shortNote: string | null
  }

  // Transcription
  transcription:
    | {
        provider: string
        // Storage path (not public)
        rawTranscriptRef: string | null
        transcriptWordCount: number | null
        language: string | null
        confidence: number | null
        completedAt: string | null
        /** Firestore briefingTranscripts doc id when async pipeline stored segments. */
        transcriptId?: string | null
        segmentCount?: number | null
        durationSeconds?: number | null
      }
    | null

  // Structured report content (14 sections)
  reportContent: BriefingReportContent | null

  // Review
  agentReviewNotes: string | null

  // Delivery
  pdfStorageRef: string | null
  deliveryEmailId: string | null

  // Metadata
  createdAt: string
  updatedAt: string
  processingAttempts: number
  lastError: string | null

  /** Meeting-minutes AI report generation status (independent of transcription). */
  reportGenerationStatus?:
    | 'waiting_for_transcript'
    | 'generating'
    | 'draft_ready'
    | 'approved'
    | 'delivered'
    | 'failed'
    | null
  meetingMinutesVersionId?: string | null
  meetingMinutesPromptVersion?: string | null
}

// Compatibility exports for existing UI routes/components.
// The frontend historically used "BriefingReport" naming and expects
// `reviewNotes` and `content` aliases.
export type BriefingReportStatus = ReportStatus

export type BriefingReport = BriefingIntelligenceReport & {
  reviewNotes: string | null
  content: BriefingReportContent | null

  // UI compatibility aliases (used by existing pages).
  tenderTitle?: string | null
  tenderNumber?: string | null
  tender?: { title: string | null; tenderNumber: string | null }
  slaDueAt?: string | null
  slaDeadlineAt?: string | null
  date?: string | null
}

// The 14-section report content.
export interface BriefingReportContent {
  coverHeader: {
    reportId: string
    tenderTitle: string
    tenderReference: string
    issuingEntity: string
    briefingDate: string
    briefingVenue: string
    reportDate: string
  }

  tenderDetails: {
    description: string | null
    closingDate: string | null
    estimatedValue: string | null
    category: string | null
    province: string | null
  }

  executiveSummary: {
    summary: string
    keyTakeaway: string
  }

  keyRequirements: Array<{
    requirement: string
    source: 'stated' | 'inferred'
  }>

  clarifications: Array<{
    question: string
    answer: string
    source: 'stated' | 'inferred' | 'not_discussed'
  }>

  questionsAndAnswers: Array<{
    question: string
    answer: string
    askedBy: string | null
  }>

  changesAndAddenda: Array<{
    change: string
    impact: string | null
  }>

  complianceRisks: Array<{
    risk: string
    severity: 'high' | 'medium' | 'low'
    mitigation: string | null
  }>

  keyDates: Array<{
    date: string
    description: string
  }>

  recommendedActions: Array<{
    action: string
    priority: 'high' | 'medium' | 'low'
    deadline: string | null
  }>

  attendanceInfo: {
    estimatedAttendees: number | null
    agentArrivalTime: string | null
    briefingDuration: string | null
  }

  attendanceVerification: {
    verified: boolean
    method: string
    notes: string | null
    redactedAttendeeCount: number | null
  }

  agentFieldObservations: {
    siteInspection: boolean | null
    docsDistributed: boolean | null
    importantAnnouncement: boolean | null
    generalNotes: string | null
  }

  sourceAndVerification: {
    audioRecorded: boolean
    transcriptionProvider: string | null
    aiModel: string | null
    processingDate: string | null
    confidenceScore: number | null
  }

  importantNotice: string

  reportCertification: {
    certifiedBy: string
    certificationDate: string
    reportVersion: string
  }
}

