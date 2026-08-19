import { describe, it, expect } from 'vitest'

import { calculateSlaDeadlineISO, computeSlaBreached } from '../../../lib/briefing-intelligence/slaService'

describe('Briefing Intelligence SLA service', () => {
  it('calculates a 24h deadline from evidenceSubmittedAt', () => {
    const submittedAt = '2026-08-19T10:00:00.000Z'
    const deadline = calculateSlaDeadlineISO(submittedAt)
    expect(deadline).toBe(new Date(Date.parse(submittedAt) + 24 * 60 * 60 * 1000).toISOString())
  })

  it('detects breaches (strictly greater than deadline)', () => {
    const submittedAt = '2026-08-19T10:00:00.000Z'
    const deadlineMs = Date.parse(submittedAt) + 24 * 60 * 60 * 1000

    const notBreachedAtDeadline = computeSlaBreached(submittedAt, new Date(deadlineMs))
    expect(notBreachedAtDeadline).toBe(false)

    const breachedAfterDeadline = computeSlaBreached(submittedAt, new Date(deadlineMs + 1))
    expect(breachedAfterDeadline).toBe(true)
  })

  it('handles timezone offsets correctly', () => {
    const submittedAt = '2026-08-19T10:00:00.000+02:00'
    const deadline = calculateSlaDeadlineISO(submittedAt)

    const expected = new Date(Date.parse(submittedAt) + 24 * 60 * 60 * 1000).toISOString()
    expect(deadline).toBe(expected)
  })

  it('treats leap second / invalid ISO as null and non-breached', () => {
    const invalidLeapSecond = '2016-12-31T23:59:60Z'
    expect(calculateSlaDeadlineISO(invalidLeapSecond)).toBeNull()
    expect(computeSlaBreached(invalidLeapSecond, new Date())).toBe(false)
  })

  it('returns non-breached when evidenceSubmittedAt is null', () => {
    expect(computeSlaBreached(null, new Date('2026-01-01T00:00:00Z'))).toBe(false)
  })
})

