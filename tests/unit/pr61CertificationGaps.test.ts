/**
 * PR #61 certification harness — private tender publish → R349 booking snapshot,
 * Founder approval idempotency, notification fail-soft, abuse validation.
 * Never logs secrets.
 */
import { describe, expect, it } from 'vitest'
import { createRequire } from 'module'
import fs from 'fs'
import path from 'path'

const require = createRequire(import.meta.url)

describe('PR61 private tender certification gaps', () => {
  it('approval mapping is idempotent (same canonical tender id)', () => {
    const svc = require('../../backend/services/privateTenderSubmissionService.js')
    const submission = {
      id: 'pts-cert-idem',
      tenderReference: 'CERT-REF-1',
      title: 'Cert tender',
      description: 'Compulsory briefing certification tender for private sector publishing.',
      companyName: 'Cert Co',
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
    const b = svc.mapToCanonicalTender(
      { ...submission, publishedTenderId: a.id },
      a.id,
      new Date('2099-01-03T00:00:00.000Z')
    )
    expect(a.id).toBe('priv-pts-cert-idem')
    expect(b.id).toBe(a.id)
    expect(a.sourceType).toBe('private')
    expect(a.visibility).toBe('public')
  })

  it('publishSubmission short-circuits when already published', async () => {
    const storageAdapter = require('../../backend/services/storageAdapter')
    const svc = require('../../backend/services/privateTenderSubmissionService.js')
    const calls = { upsert: 0 }
    const originalGetStorage = storageAdapter.getStorage
    storageAdapter.getStorage = () => ({
      getTenderById: async (id: string) => ({ id, sourceType: 'private', title: 'Existing' }),
      upsertTenders: async () => {
        calls.upsert += 1
        return { written: 1 }
      },
    })

    try {
      const first = await svc.publishSubmission(
        {
          id: 'pts-already',
          status: 'published',
          publishedTenderId: 'priv-pts-already',
          tenderReference: 'R',
          title: 'T',
          description: 'D'.repeat(50),
          companyName: 'C',
          province: 'Gauteng',
          category: 'ICT',
          closingDate: '2099-12-01',
          briefingDate: '2099-11-01',
          briefingTime: '10:00',
          briefingVenue: 'V',
          tenderDocument: { fileName: 'a.pdf', contentType: 'application/pdf', storagePath: 'x' },
          supportingDocuments: [],
        },
        { uid: 'f1' }
      )
      expect(first.created).toBe(false)
      expect(first.tenderId).toBe('priv-pts-already')
      expect(calls.upsert).toBe(0)
    } finally {
      storageAdapter.getStorage = originalGetStorage
    }
  })

  it('private tender booking uses R349 / R200 commercial constants (no alternate path)', async () => {
    const {
      BRIEFING_PRICE_CENTS,
      YOUTH_AGENT_PAYOUT_CENTS,
      GROSS_CONTRIBUTION_CENTS,
    } = await import('../../lib/domain/briefingPricing')
    expect(BRIEFING_PRICE_CENTS).toBe(34900)
    expect(YOUTH_AGENT_PAYOUT_CENTS).toBe(20000)
    expect(GROSS_CONTRIBUTION_CENTS).toBe(14900)

    expect(fs.existsSync(path.join(process.cwd(), 'backend/services/privateBooking.js'))).toBe(false)
    expect(fs.existsSync(path.join(process.cwd(), 'app/api/private-bookings'))).toBe(false)
  })

  it('notification failures do not throw from email helpers (fail-soft contract)', async () => {
    const email = require('../../lib/services/privateTenderEmail.js')
    const prev = process.env.RESEND_API_KEY
    delete process.env.RESEND_API_KEY
    try {
      const ack = await email.sendPrivateTenderSubmittedAck({
        to: 'company@example.com',
        companyName: 'Co',
        title: 'T',
        tenderReference: 'R-1',
        trackingToken: 'token',
        submissionId: 'pts-1',
      })
      expect(ack.sent).toBe(false)
      expect(ack.skipped).toBe(true)

      const pub = await email.sendPrivateTenderPublished({
        to: 'company@example.com',
        companyName: 'Co',
        title: 'T',
        tenderReference: 'R-1',
        publishedTenderId: 'priv-1',
        submissionId: 'pts-1',
      })
      expect(pub.sent).toBe(false)

      const rej = await email.sendPrivateTenderRejected({
        to: 'company@example.com',
        companyName: 'Co',
        tenderReference: 'R-1',
        reason: 'Incomplete',
        submissionId: 'pts-1',
      })
      expect(rej.sent).toBe(false)
    } finally {
      if (prev !== undefined) process.env.RESEND_API_KEY = prev
    }
  })

  it('Founder review route catches email failures without converting to 500', () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'app/api/founder/private-tenders/[id]/review/route.ts'),
      'utf8'
    )
    expect(src).toMatch(/review email failed/)
    expect(src).toMatch(/return NextResponse\.json\(\{ success: true/)
  })

  it('submit route catches ack email failures', () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'app/api/private-tenders/submit/route.ts'),
      'utf8'
    )
    expect(src).toMatch(/ack email failed/)
    expect(src).toMatch(/status: 201/)
  })
})
