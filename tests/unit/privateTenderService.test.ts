import { describe, expect, it } from 'vitest'

/**
 * Service-level publish idempotency without live Firestore —
 * exercises the pure mapper + review guard logic in isolation.
 */
describe('private tender review service contract', () => {
  it('mapToCanonicalTender is stable across repeated calls', () => {
    const svc = require('../../backend/services/privateTenderSubmissionService.js')
    const submission = {
      id: 'pts-idem-1',
      tenderReference: 'REF-1',
      title: 'Title',
      description: 'Description long enough for a private tender briefing opportunity.',
      companyName: 'Co',
      province: 'Gauteng',
      category: 'ICT',
      closingDate: '2099-12-01',
      closingTime: '12:00',
      briefingDate: '2099-11-20',
      briefingTime: '09:00',
      briefingVenue: 'Venue',
      briefingInstructions: '',
      municipality: '',
      eligibilityRequirements: '',
      submissionInstructions: '',
      procurementContactName: '',
      procurementContactEmail: '',
      procurementContactPhone: '',
      contactPersonName: 'A',
      contactEmail: 'a@test.com',
      contactPhone: '',
      meetingLink: '',
      tenderDocument: {
        fileName: 'a.pdf',
        contentType: 'application/pdf',
        storagePath: 'private-tender-submissions/x/a.pdf',
      },
      supportingDocuments: [],
      submittedAt: '2099-01-01T00:00:00.000Z',
      publishedTenderId: null,
    }

    const a = svc.mapToCanonicalTender(submission, null, new Date('2099-01-02T00:00:00.000Z'))
    const b = svc.mapToCanonicalTender(submission, null, new Date('2099-01-02T00:00:00.000Z'))
    expect(a.id).toBe('priv-pts-idem-1')
    expect(b.id).toBe(a.id)
    expect(a.sourceType).toBe('private')
    expect(a.visibility).toBe('public')
    expect(a.briefingCompulsory).toBe(true)
  })

  it('toPublicStatus strips internal fields', () => {
    const svc = require('../../backend/services/privateTenderSubmissionService.js')
    const pub = svc.toPublicStatus({
      id: 'pts-1',
      trackingToken: 'abc',
      status: 'rejected',
      title: 'T',
      tenderReference: 'R',
      companyName: 'C',
      submittedAt: '2099-01-01T00:00:00.000Z',
      publishedTenderId: null,
      rejectionReason: 'Incomplete venue',
      changesRequestedNote: null,
      reviewedByUid: 'founder-1',
      audit: [{ action: 'rejected' }],
    })
    expect(pub.rejectionReason).toBe('Incomplete venue')
    expect(pub).not.toHaveProperty('reviewedByUid')
    expect(pub).not.toHaveProperty('audit')
  })
})
