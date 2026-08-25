import {
  isAllowedTenderDocument,
  MAX_TENDER_DOCUMENT_BYTES,
  PRIVATE_TENDER_PROVINCES,
} from './constants'
import type { PrivateTenderDocumentMeta, PrivateTenderSubmissionInput } from './types'

export type ValidationIssue = { field: string; message: string }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i
const URL_RE = /^https?:\/\/.+/i

function trimStr(value: unknown, max = 500): string {
  return String(value ?? '')
    .trim()
    .slice(0, max)
}

function parseDateOnly(value: string): Date | null {
  const raw = trimStr(value, 32)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null
  const d = new Date(`${raw}T12:00:00+02:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

function parseDateTime(date: string, time: string): Date | null {
  const d = trimStr(date, 32)
  const t = trimStr(time, 16) || '00:00'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null
  if (!/^\d{2}:\d{2}$/.test(t)) return null
  const parsed = new Date(`${d}T${t}:00+02:00`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function validateDocument(
  doc: PrivateTenderDocumentMeta | undefined,
  field: string,
  required: boolean
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  if (!doc) {
    if (required) issues.push({ field, message: 'Tender document is required' })
    return issues
  }
  if (!trimStr(doc.fileName, 200)) {
    issues.push({ field: `${field}.fileName`, message: 'Document file name is required' })
  }
  if (!trimStr(doc.storagePath, 500)) {
    issues.push({ field: `${field}.storagePath`, message: 'Document storage path is required' })
  }
  if (!isAllowedTenderDocument(doc.fileName, doc.contentType)) {
    issues.push({
      field: `${field}.contentType`,
      message: 'Only PDF, DOC, or DOCX documents are allowed',
    })
  }
  if (!Number.isFinite(doc.sizeBytes) || doc.sizeBytes <= 0) {
    issues.push({ field: `${field}.sizeBytes`, message: 'Document size is invalid' })
  } else if (doc.sizeBytes > MAX_TENDER_DOCUMENT_BYTES) {
    issues.push({
      field: `${field}.sizeBytes`,
      message: `Document exceeds ${Math.floor(MAX_TENDER_DOCUMENT_BYTES / (1024 * 1024))} MB limit`,
    })
  }
  return issues
}

/**
 * Validate a private tender submission for Phase 1.
 * Requires compulsory briefing before closing.
 */
export function validatePrivateTenderSubmission(
  input: Partial<PrivateTenderSubmissionInput>,
  options: { now?: Date } = {}
): { ok: true; value: PrivateTenderSubmissionInput } | { ok: false; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = []
  const now = options.now || new Date()

  // Honeypot
  if (trimStr(input.websiteUrl, 200)) {
    issues.push({ field: 'websiteUrl', message: 'Rejected' })
  }

  const companyName = trimStr(input.companyName, 200)
  if (!companyName) issues.push({ field: 'companyName', message: 'Company name is required' })

  const contactPersonName = trimStr(input.contactPersonName, 120)
  if (!contactPersonName) {
    issues.push({ field: 'contactPersonName', message: 'Contact person is required' })
  }

  const contactEmail = trimStr(input.contactEmail, 200).toLowerCase()
  if (!contactEmail || !EMAIL_RE.test(contactEmail)) {
    issues.push({ field: 'contactEmail', message: 'A valid contact email is required' })
  }

  const title = trimStr(input.title, 300)
  if (!title) issues.push({ field: 'title', message: 'Tender title is required' })

  const tenderReference = trimStr(input.tenderReference, 120)
  if (!tenderReference) {
    issues.push({ field: 'tenderReference', message: 'Tender reference is required' })
  }

  const description = trimStr(input.description, 8000)
  if (!description || description.length < 40) {
    issues.push({
      field: 'description',
      message: 'Description must be at least 40 characters',
    })
  }

  const category = trimStr(input.category, 120)
  if (!category) issues.push({ field: 'category', message: 'Category is required' })

  const province = trimStr(input.province, 80)
  if (!province) {
    issues.push({ field: 'province', message: 'Province is required' })
  } else if (!(PRIVATE_TENDER_PROVINCES as readonly string[]).includes(province)) {
    issues.push({ field: 'province', message: 'Select a valid South African province' })
  }

  const closingDate = trimStr(input.closingDate, 32)
  const closingParsed = parseDateOnly(closingDate)
  if (!closingParsed) {
    issues.push({ field: 'closingDate', message: 'Closing date must be YYYY-MM-DD' })
  } else {
    const startOfToday = new Date(now)
    startOfToday.setHours(0, 0, 0, 0)
    if (closingParsed.getTime() < startOfToday.getTime() - 24 * 60 * 60 * 1000) {
      issues.push({ field: 'closingDate', message: 'Closing date must be today or in the future' })
    }
  }

  const briefingRequired = input.briefingRequired !== false
  const briefingCompulsory = input.briefingCompulsory !== false

  if (!briefingRequired) {
    issues.push({
      field: 'briefingRequired',
      message: 'Phase 1 requires a compulsory briefing session',
    })
  }
  if (!briefingCompulsory) {
    issues.push({
      field: 'briefingCompulsory',
      message: 'Phase 1 requires briefingCompulsory = true',
    })
  }

  const briefingDate = trimStr(input.briefingDate, 32)
  const briefingTime = trimStr(input.briefingTime, 16)
  const briefingAt = parseDateTime(briefingDate, briefingTime || '09:00')
  if (!briefingAt) {
    issues.push({
      field: 'briefingDate',
      message: 'Briefing date and time are required (YYYY-MM-DD and HH:MM)',
    })
  }

  const briefingVenue = trimStr(input.briefingVenue, 400)
  if (!briefingVenue) {
    issues.push({ field: 'briefingVenue', message: 'Briefing venue or meeting instructions are required' })
  }

  if (briefingAt && closingParsed) {
    const closingTime = trimStr(input.closingTime, 16) || '23:59'
    const closingAt = parseDateTime(closingDate, closingTime) || closingParsed
    if (briefingAt.getTime() >= closingAt.getTime()) {
      issues.push({
        field: 'briefingDate',
        message: 'Briefing must occur before the tender closing date/time',
      })
    }
  }

  const website = trimStr(input.website, 300)
  if (website && !URL_RE.test(website)) {
    issues.push({ field: 'website', message: 'Website must start with http:// or https://' })
  }

  const meetingLink = trimStr(input.meetingLink, 500)
  if (meetingLink && !URL_RE.test(meetingLink)) {
    issues.push({ field: 'meetingLink', message: 'Meeting link must be a valid URL' })
  }

  const procurementContactEmail = trimStr(input.procurementContactEmail, 200).toLowerCase()
  if (procurementContactEmail && !EMAIL_RE.test(procurementContactEmail)) {
    issues.push({
      field: 'procurementContactEmail',
      message: 'Procurement contact email is invalid',
    })
  }

  issues.push(...validateDocument(input.tenderDocument, 'tenderDocument', true))
  for (let i = 0; i < (input.supportingDocuments || []).length; i++) {
    issues.push(
      ...validateDocument(input.supportingDocuments![i], `supportingDocuments[${i}]`, false)
    )
  }

  if (issues.length) return { ok: false, issues }

  const value: PrivateTenderSubmissionInput = {
    companyName,
    registrationNumber: trimStr(input.registrationNumber, 80),
    website,
    contactPersonName,
    contactEmail,
    contactPhone: trimStr(input.contactPhone, 40),
    title,
    tenderReference,
    description,
    category,
    province,
    municipality: trimStr(input.municipality, 120),
    closingDate,
    closingTime: trimStr(input.closingTime, 16),
    briefingRequired: true,
    briefingCompulsory: true,
    briefingDate,
    briefingTime: briefingTime || '09:00',
    briefingVenue,
    briefingInstructions: trimStr(input.briefingInstructions, 2000),
    registrationRequired: Boolean(input.registrationRequired),
    registrationInstructions: trimStr(input.registrationInstructions, 2000),
    virtualBriefing: Boolean(input.virtualBriefing),
    meetingLink,
    eligibilityRequirements: trimStr(input.eligibilityRequirements, 4000),
    submissionInstructions: trimStr(input.submissionInstructions, 4000),
    procurementContactName: trimStr(input.procurementContactName, 120),
    procurementContactEmail,
    procurementContactPhone: trimStr(input.procurementContactPhone, 40),
    tenderDocument: input.tenderDocument!,
    supportingDocuments: input.supportingDocuments || [],
  }

  return { ok: true, value }
}

export function normalizeDuplicateKey(companyName: string, tenderReference: string): string {
  return `${companyName}|${tenderReference}`
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}
