/**
 * Meeting-minutes report types (client-facing structured content).
 * Transcript remains internal; this schema must NOT include speaker labels.
 */

export type ProvenanceSourceType = 'briefing_audio' | 'tender_document' | 'combined' | 'official_metadata'

export type ProvenanceRef = {
  text: string
  sourceType: ProvenanceSourceType
  transcriptSegmentIds?: string[]
  startSeconds?: number | null
  tenderDocumentChunkIds?: string[]
  page?: number | null
}

export type BriefingSummary = {
  purposeOfBriefing: string
  departmentExplanation: string[]
  priorityDeliverables: string[]
  scopeClarifications: string[]
  questionsAndClarifications: Array<{
    heading: string
    summary: string
    unresolved?: boolean
  }>
  experienceRequirements: string[]
  complianceClarifications: string[]
  durationAndTimelines: string[]
  importantDates: string[]
  /** Structured amendments — high commercial priority. Prefer over free-text list. */
  amendments: Array<{
    tenderRequirement: string
    briefingChange: string
    bidderImplication: string
  }>
  /** @deprecated prefer amendments[] */
  amendmentsOrChanges: string[]
  workExpected: string[]
  mainPointsToRemember: Array<{ matter: string; detail: string }>
  unresolvedItems: Array<{ topic: string; reason: string }>
  /** Internal only — not shown in client PDF by default */
  provenance: ProvenanceRef[]
  /** Internal: whether full tender PDF text was available for comparison */
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
  questionsAndClarifications: Array<{ heading: string; summary: string }>
  registrationAndCompliance: string
  durationAndTimelines: string
  mainPoints: Array<{ matter: string; detail: string }>
  amendments: Array<{
    tenderRequirement: string
    briefingChange: string
    bidderImplication: string
  }>
  /** Fallback free-text when structured amendments empty (legacy) */
  amendmentsOrChanges: string[]
  amendmentsNoneMessage: string | null
  closingDate: string | null
  closingTime: string | null
  attendanceNote: string | null
  briefingCertificateNote: string | null
  /** Internal provenance retained for audit */
  provenance: ProvenanceRef[]
  /** Internal only — do not show in client PDF */
  documentComparisonStatus: 'full' | 'metadata_only' | 'unavailable'
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
