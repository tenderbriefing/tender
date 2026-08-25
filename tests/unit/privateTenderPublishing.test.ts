import { describe, expect, it } from 'vitest'
import { validatePrivateTenderSubmission } from '@/lib/privateTenders/validation'
import { isAllowedTenderDocument, MAX_TENDER_DOCUMENT_BYTES } from '@/lib/privateTenders/constants'
import {
  isPrivateSectorTender,
  mapSubmissionToCanonicalTender,
} from '@/lib/privateTenders/publishMapper'
import type { PrivateTenderSubmission } from '@/lib/privateTenders/types'

const futureClosing = '2099-12-20'
const futureBriefing = '2099-12-10'

function validDoc() {
  return {
    fileName: 'tender.pdf',
    contentType: 'application/pdf',
    sizeBytes: 12_000,
    storagePath: 'private-tender-submissions/draft/tender_document/tender.pdf',
    uploadedAt: '2099-01-01T00:00:00.000Z',
    kind: 'tender_document' as const,
  }
}

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    companyName: 'Acme Construction (Pty) Ltd',
    contactPersonName: 'Thandi Mokoena',
    contactEmail: 'thandi@acme.test',
    title: 'Supply and install generators for regional depot',
    tenderReference: 'ACME-GEN-2099-01',
    description:
      'Compulsory briefing required. Supply and installation of backup generators across three depot sites with maintenance plan.',
    category: 'Facilities',
    province: 'Gauteng',
    closingDate: futureClosing,
    briefingRequired: true,
    briefingCompulsory: true,
    briefingDate: futureBriefing,
    briefingTime: '10:00',
    briefingVenue: 'Acme HQ, Sandton',
    tenderDocument: validDoc(),
    ...overrides,
  }
}

describe('private tender validation', () => {
  it('accepts a valid Phase 1 submission', () => {
    const result = validatePrivateTenderSubmission(validInput())
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.briefingCompulsory).toBe(true)
      expect(result.value.companyName).toContain('Acme')
    }
  })

  it('rejects missing company', () => {
    const result = validatePrivateTenderSubmission(validInput({ companyName: '' }))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues.some((i) => i.field === 'companyName')).toBe(true)
    }
  })

  it('rejects missing tender reference', () => {
    const result = validatePrivateTenderSubmission(validInput({ tenderReference: '  ' }))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues.some((i) => i.field === 'tenderReference')).toBe(true)
    }
  })

  it('rejects missing briefing', () => {
    const result = validatePrivateTenderSubmission(
      validInput({ briefingRequired: false, briefingCompulsory: false, briefingDate: '' })
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(
        result.issues.some(
          (i) => i.field === 'briefingRequired' || i.field === 'briefingCompulsory' || i.field === 'briefingDate'
        )
      ).toBe(true)
    }
  })

  it('rejects invalid closing date', () => {
    const result = validatePrivateTenderSubmission(validInput({ closingDate: 'not-a-date' }))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues.some((i) => i.field === 'closingDate')).toBe(true)
    }
  })

  it('rejects briefing after closing', () => {
    const result = validatePrivateTenderSubmission(
      validInput({
        closingDate: '2099-12-01',
        briefingDate: '2099-12-15',
        briefingTime: '10:00',
      })
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues.some((i) => i.field === 'briefingDate')).toBe(true)
    }
  })

  it('rejects unsafe file types', () => {
    expect(isAllowedTenderDocument('malware.exe', 'application/octet-stream')).toBe(false)
    expect(isAllowedTenderDocument('tender.pdf', 'application/pdf')).toBe(true)
  })

  it('rejects oversized document metadata', () => {
    const result = validatePrivateTenderSubmission(
      validInput({
        tenderDocument: {
          ...validDoc(),
          sizeBytes: MAX_TENDER_DOCUMENT_BYTES + 1,
        },
      })
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues.some((i) => i.field.includes('sizeBytes'))).toBe(true)
    }
  })
})

describe('private tender publish mapping', () => {
  const submission = {
    id: 'pts-test-1',
    trackingToken: 'token',
    status: 'submitted',
    companyName: 'Acme Construction (Pty) Ltd',
    registrationNumber: '',
    website: '',
    contactPersonName: 'Thandi',
    contactEmail: 'thandi@acme.test',
    contactPhone: '',
    title: 'Generator supply',
    tenderReference: 'ACME-GEN-2099-01',
    description: 'Compulsory briefing for generator supply across depots.',
    category: 'Facilities',
    province: 'Gauteng',
    municipality: 'Johannesburg',
    closingDate: futureClosing,
    closingTime: '16:00',
    briefingRequired: true,
    briefingCompulsory: true,
    briefingDate: futureBriefing,
    briefingTime: '10:00',
    briefingVenue: 'Acme HQ',
    briefingInstructions: 'Bring ID',
    registrationRequired: false,
    registrationInstructions: '',
    virtualBriefing: false,
    meetingLink: '',
    eligibilityRequirements: 'CIDB 3GB',
    submissionInstructions: 'Email bids',
    procurementContactName: 'Thandi',
    procurementContactEmail: 'thandi@acme.test',
    procurementContactPhone: '',
    tenderDocument: validDoc(),
    supportingDocuments: [],
    submittedAt: '2099-01-01T00:00:00.000Z',
    submittedByUid: null,
    submittedByEmail: null,
    submittedIpHash: null,
    reviewedAt: null,
    reviewedByUid: null,
    reviewedByEmail: null,
    rejectionReason: null,
    changesRequestedNote: null,
    publishedTenderId: null,
    publishedAt: null,
    duplicateFlags: [],
    audit: [],
    createdAt: '2099-01-01T00:00:00.000Z',
    updatedAt: '2099-01-01T00:00:00.000Z',
  } satisfies PrivateTenderSubmission

  it('maps to canonical tender with sourceType=private and public visibility', () => {
    const tender = mapSubmissionToCanonicalTender(submission, {
      publishedTenderId: 'priv-pts-test-1',
    })
    expect(tender.id).toBe('priv-pts-test-1')
    expect(tender.sourceType).toBe('private')
    expect(tender.visibility).toBe('public')
    expect(tender.briefingCompulsory).toBe(true)
    expect(tender.department).toBe(submission.companyName)
    expect(tender.privateSubmissionId).toBe(submission.id)
    expect(isPrivateSectorTender(tender)).toBe(true)
  })

  it('uses deterministic id for idempotent republish', () => {
    const a = mapSubmissionToCanonicalTender(submission)
    const b = mapSubmissionToCanonicalTender(submission)
    expect(a.id).toBe(b.id)
    expect(a.id).toBe(`priv-${submission.id}`)
  })
})

describe('commercial invariants regression (private tenders)', () => {
  it('preserves R349 / R200 cents constants', async () => {
    const {
      BRIEFING_PRICE_CENTS,
      YOUTH_AGENT_PAYOUT_CENTS,
      GROSS_CONTRIBUTION_CENTS,
    } = await import('@/lib/domain/briefingPricing')
    expect(BRIEFING_PRICE_CENTS).toBe(34900)
    expect(YOUTH_AGENT_PAYOUT_CENTS).toBe(20000)
    expect(GROSS_CONTRIBUTION_CENTS).toBe(14900)
  })
})
