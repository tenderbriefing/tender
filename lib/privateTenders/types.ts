/**
 * Private company tender intake — Phase 1.
 * Intake/review lives in `privateTenderSubmissions`.
 * Published opportunities use the canonical `tenderBriefings` model with sourceType=private.
 */

export const PRIVATE_TENDER_SUBMISSION_STATUSES = [
  'submitted',
  'under_review',
  'changes_requested',
  'approved',
  'rejected',
  'published',
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
  briefingDate: string
  briefingTime: string
  briefingVenue: string
  briefingInstructions?: string
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

  tenderDocument: PrivateTenderDocumentMeta
  supportingDocuments: PrivateTenderDocumentMeta[]

  submittedAt: string
  submittedByUid: string | null
  submittedByEmail: string | null
  submittedIpHash: string | null

  reviewedAt: string | null
  reviewedByUid: string | null
  reviewedByEmail: string | null
  rejectionReason: string | null
  changesRequestedNote: string | null

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
