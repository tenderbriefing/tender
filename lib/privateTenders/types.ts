/**
 * Private company tender intake — Phase 1.
 * Intake/review lives in `privateTenderSubmissions`.
 * Published opportunities use the canonical `tenderBriefings` model with sourceType=private.
 */

/** Phase 1 + Phase 2 statuses (see statusMachine.ts for transitions). */
export const PRIVATE_TENDER_SUBMISSION_STATUSES = [
  'draft',
  'submitted',
  'under_review',
  'changes_requested',
  'approved',
  'rejected',
  'published',
  'withdrawn',
  'closed',
  'archived',
] as const

export type PrivateTenderSubmissionStatus =
  (typeof PRIVATE_TENDER_SUBMISSION_STATUSES)[number]

export const PRIVATE_TENDER_REVIEW_ACTIONS = [
  'approve',
  'reject',
  'request_changes',
] as const

export type PrivateTenderReviewAction = (typeof PRIVATE_TENDER_REVIEW_ACTIONS)[number]

export type TenderSourceType = 'public' | 'private'

export interface PrivateTenderDocumentMeta {
  fileName: string
  contentType: string
  sizeBytes: number
  storagePath: string
  uploadedAt: string
  kind: 'tender_document' | 'supporting'
}

export interface PrivateTenderSubmissionInput {
  companyName: string
  registrationNumber?: string
  website?: string
  contactPersonName: string
  contactEmail: string
  contactPhone?: string

  title: string
  tenderReference: string
  description: string
  category: string
  province: string
  municipality?: string
  closingDate: string
  closingTime?: string

  briefingRequired: boolean
  briefingCompulsory: boolean
  /** Phase 3 — physical | online | none */
  briefingType?: 'physical' | 'online' | 'none'
  briefingDate: string
  briefingTime: string
  briefingStartTime?: string
  briefingEndTime?: string
  briefingVenue: string
  briefingAddress?: string
  briefingProvince?: string
  briefingMunicipality?: string
  briefingInstructions?: string
  briefingContactDetails?: string
  briefingRegistrationDeadline?: string
  registrationRequired?: boolean
  registrationInstructions?: string
  virtualBriefing?: boolean
  meetingLink?: string

  eligibilityRequirements?: string
  submissionInstructions?: string
  procurementContactName?: string
  procurementContactEmail?: string
  procurementContactPhone?: string

  tenderDocument: PrivateTenderDocumentMeta
  supportingDocuments?: PrivateTenderDocumentMeta[]

  /** Client honeypot — must be empty. */
  websiteUrl?: string
}

export interface PrivateTenderSubmissionAuditEntry {
  at: string
  action: string
  actorUid?: string | null
  actorEmail?: string | null
  note?: string | null
}

export interface PrivateTenderSubmission {
  id: string
  trackingToken: string
  status: PrivateTenderSubmissionStatus

  /** Phase 2 — organisation workspace (absent on legacy Phase 1 guest rows). */
  organisationId?: string | null
  createdByUid?: string | null

  companyName: string
  registrationNumber: string
  website: string
  contactPersonName: string
  contactEmail: string
  contactPhone: string

  title: string
  tenderReference: string
  description: string
  category: string
  province: string
  municipality: string
  closingDate: string
  closingTime: string

  briefingRequired: boolean
  briefingCompulsory: boolean
  briefingDate: string
  briefingTime: string
  briefingVenue: string
  briefingInstructions: string
  registrationRequired: boolean
  registrationInstructions: string
  virtualBriefing: boolean
  meetingLink: string

  eligibilityRequirements: string
  submissionInstructions: string
  procurementContactName: string
  procurementContactEmail: string
  procurementContactPhone: string

  tenderDocument: PrivateTenderDocumentMeta | null
  supportingDocuments: PrivateTenderDocumentMeta[]

  submittedAt: string | null
  submittedByUid: string | null
  submittedByEmail: string | null
  submittedIpHash: string | null

  reviewedAt: string | null
  reviewedByUid: string | null
  reviewedByEmail: string | null
  rejectionReason: string | null
  changesRequestedNote: string | null
  changesRequestedCategory?: string | null
  reviewHistory?: Array<{
    at: string
    action: string
    note?: string | null
    category?: string | null
    actorUid?: string | null
    actorEmail?: string | null
  }>

  publishedTenderId: string | null
  publishedAt: string | null

  duplicateFlags: string[]
  audit: PrivateTenderSubmissionAuditEntry[]

  createdAt: string
  updatedAt: string
}

export interface PrivateTenderPublicStatus {
  id: string
  trackingToken: string
  status: PrivateTenderSubmissionStatus
  title: string
  tenderReference: string
  companyName: string
  submittedAt: string
  publishedTenderId: string | null
  rejectionReason: string | null
  changesRequestedNote: string | null
}
