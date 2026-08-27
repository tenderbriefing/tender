/**
 * Meeting-minutes report types (client-facing structured content).
 * Transcript remains the source of truth; this schema must NOT include speaker labels.
 */

export type ProvenanceSourceType = 'briefing_audio' | 'tender_document' | 'combined' | 'official_metadata'

export type ProvenanceRef = {
  text: string
  sourceType: ProvenanceSourceType
  transcriptSegmentIds?: string[]
  startSeconds?: number | null
  endSeconds?: number | null
  tenderDocumentChunkIds?: string[]
  page?: number | null
}

/** Standard phrase when a section has no transcript support. */
export const NOT_DISCUSSED_IN_BRIEFING = 'Not discussed in the recorded briefing.'

export type ClarificationKind = 'confirmed_change' | 'clarification_only' | 'possible_future_amendment'

export type BriefingQaPair = {
  question: string
  answer: string
  unresolved?: boolean
  /** @deprecated Optional internal only — never required; never shown to SME. */
  sourceStartSeconds?: number | null
  /** @deprecated Optional internal only — never required; never shown to SME. */
  sourceEndSeconds?: number | null
  /** @deprecated Optional internal only — never required; never shown to SME. */
  transcriptSegmentIds?: string[]
}

export type BriefingSummary = {
  purposeOfBriefing: string
  departmentExplanation: string[]
  priorityDeliverables: string[]
  scopeClarifications: string[]
  questionsAndAnswers: BriefingQaPair[]
  questionsAndClarifications: Array<{
    heading: string
    summary: string
    unresolved?: boolean
  }>
  experienceRequirements: string[]
  complianceClarifications: string[]
  keyRequirementsDiscussed: string[]
  submissionRequirements: string[]
  durationAndTimelines: string[]
  importantDates: Array<{ date: string; description: string; uncertain?: boolean }>
  amendments: Array<{
    tenderRequirement: string
    briefingChange: string
    bidderImplication: string
    kind?: ClarificationKind
  }>
  /** @deprecated prefer amendments[] */
  amendmentsOrChanges: string[]
  workExpected: string[]
  technicalObservations: string[]
  risksAndWatchOuts: string[]
  actionsForSme: Array<{ action: string; deadline: string | null }>
  mainPointsToRemember: Array<{ matter: string; detail: string }>
  unresolvedItems: Array<{ topic: string; reason: string }>
  verificationItems: Array<{ item: string; reason: string }>
  /** Optional legacy field — not required; not shown in SME PDF. */
  provenance?: ProvenanceRef[]
  documentComparisonStatus?: 'full' | 'metadata_only' | 'unavailable'
}

export type StructuredMeetingMinutesReport = {
  cover: {
    tenderTitle: string
    tenderNumber: string
    department: string
    briefingDate: string
    briefingVenue: string
    preparedBy: string
    reportDate: string
  }
  purposeOfBriefing: string
  whatDepartmentExplained: string[]
  priorityDeliverables: string[]
  scopeClarifications: string[]
  workExpected: string[]
  experienceRequired: string
  keyRequirementsDiscussed: string[]
  submissionRequirements: string[]
  questionsAndClarifications: Array<{ heading: string; summary: string }>
  questionsAndAnswers: BriefingQaPair[]
  registrationAndCompliance: string
  durationAndTimelines: string
  importantDates: Array<{ date: string; description: string; uncertain?: boolean }>
  technicalObservations: string[]
  risksAndWatchOuts: string[]
  actionsForSme: Array<{ action: string; deadline: string | null }>
  verificationItems: Array<{ item: string; reason: string }>
  mainPoints: Array<{ matter: string; detail: string }>
  amendments: Array<{
    tenderRequirement: string
    briefingChange: string
    bidderImplication: string
    kind?: ClarificationKind
  }>
  amendmentsOrChanges: string[]
  amendmentsNoneMessage: string | null
  closingDate: string | null
  closingTime: string | null
  attendanceNote: string | null
  briefingCertificateNote: string | null
  /** Optional legacy field — not required; not shown in SME PDF. */
  provenance?: ProvenanceRef[]
  documentComparisonStatus: 'full' | 'metadata_only' | 'unavailable'
  briefingIntelligenceV2?: import('./briefingIntelligenceV2').BriefingIntelligenceV2Sections
}

export type BriefingReportJobStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'retrying'

export type BriefingReportJob = {
  id: string
  reportId: string
  requestId: string
  tenderId: string
  agentId: string
  smeId: string
  transcriptId: string
  status: BriefingReportJobStatus
  attempts: number
  maxAttempts: number
  aiModel: string | null
  promptVersion: string
  reportVersionId: string | null
  pdfStoragePath: string | null
  errorCode: string | null
  errorMessage: string | null
  createdAt: string
  processingStartedAt: string | null
  completedAt: string | null
  updatedAt: string
  nextAttemptAt: string | null
}

export type BriefingReportVersion = {
  id: string
  reportId: string
  requestId: string
  tenderId: string
  version: number
  status: 'draft_ready' | 'approved' | 'superseded'
  structuredContent: StructuredMeetingMinutesReport
  summary: BriefingSummary | null
  pdfStoragePath: string | null
  promptVersion: string
  model: string | null
  transcriptId: string
  createdAt: string
  approvedAt: string | null
  approvedBy: string | null
}

/** Forbidden in client-facing report text. */
export const SPEAKER_LABEL_PATTERN = /\bSpeaker\s+\d+\b/gi

export function stripSpeakerLabels(text: string): string {
  return String(text || '')
    .replace(SPEAKER_LABEL_PATTERN, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export function containsSpeakerLabels(text: string): boolean {
  return /\bSpeaker\s+\d+\b/i.test(String(text || ''))
}
