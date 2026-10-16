import { describe, expect, it } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const {
  defaultSubject,
  defaultBody,
  isValidEmail,
  stripInternalLeakHints,
  buildIdempotencyKey,
} = require('../../backend/domain/clientReportDelivery')

describe('clientReportDelivery domain', () => {
  it('builds professional default subject/body', () => {
    const subject = defaultSubject({
      tenderNumber: 'RFQ-1',
      tenderDescription: 'Lab works',
    })
    expect(subject).toMatch(/^Tender Briefing Report — RFQ-1 — Lab works/)
    const body = defaultBody({
      clientName: 'Thabo',
      companyName: 'Acme',
      tenderNumber: 'RFQ-1',
      tenderDescription: 'Lab works',
    })
    expect(body).toMatch(/^Dear Thabo/)
    expect(body).toContain('TenderBriefing')
    expect(body).not.toMatch(/payout/i)
  })

  it('validates emails and blocks internal leakage', () => {
    expect(isValidEmail('a@b.co')).toBe(true)
    expect(isValidEmail('nope')).toBe(false)
    expect(() => stripInternalLeakHints('agentPayoutCents: 40000')).toThrow(/internal payout/i)
    expect(buildIdempotencyKey('r1', 'v1', 'd1')).toBe('CLIENT_REPORT_DELIVERY:r1:v1:d1')
  })
})
