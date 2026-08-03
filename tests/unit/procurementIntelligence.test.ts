import { describe, expect, it, afterEach } from 'vitest'
import { buildProcurementIntelligence } from '../../lib/procurement/intelligence/buildIntelligence'
import type { TenderBriefing } from '../../lib/tenderBriefing/types'
import {
  canAccessProcurementIntelligence,
  isProcurementIntelligenceEnabled,
  isProcurementIntelligencePilotUser,
  parseProcurementIntelligencePilotUids,
} from '../../lib/procurement/intelligence/featureFlag'

function tender(partial: Partial<TenderBriefing> = {}): TenderBriefing {
  return {
    id: 't1',
    title: 'Cleaning services for provincial hospital',
    description: 'Provide cleaning and hygiene services',
    province: 'Gauteng',
    department: 'Health',
    buyer: 'Gauteng DoH',
    category: 'cleaning',
    briefingCompulsory: true,
    briefingDate: '2026-08-10',
    closingDate: '2026-08-30',
    documents: [{ name: 'TOR.pdf', url: 'https://example.com/tor.pdf' }],
    ...partial,
  } as TenderBriefing
}

function clearPiEnv() {
  delete process.env.PROCUREMENT_INTELLIGENCE_ENABLED
  delete process.env.PROCUREMENT_INTELLIGENCE_PILOT_UIDS
  delete process.env.NEXT_PUBLIC_PROCUREMENT_INTELLIGENCE_ENABLED
}

describe('procurement intelligence phase 1', () => {
  afterEach(() => {
    clearPiEnv()
  })

  it('builds structured intelligence with non-definitive eligibility', () => {
    const result = buildProcurementIntelligence(tender(), {
      uid: 'sme-a',
      province: 'Gauteng',
      categories: ['cleaning'],
      csdRegistered: true,
      taxClearanceValid: true,
    })
    expect(result.machineAssisted).toBe(true)
    expect(result.eligibility.definitiveEligible).toBe(false)
    expect(result.opportunityFit.label).toBe('Opportunity Fit')
    expect(result.opportunityFit.score).toBeGreaterThanOrEqual(0)
    expect(result.checklist.length).toBeGreaterThan(0)
    expect(result.summary.inferredNotes.length).toBeGreaterThan(0)
    expect(result.recommendedActions.some((a) => a.id === 'book-agent')).toBe(true)
  })

  it('marks insufficient information when profile empty', () => {
    const result = buildProcurementIntelligence(tender({ briefingCompulsory: false }), {
      uid: 'sme-b',
    })
    expect(['insufficient_information', 'eligibility_uncertain', 'likely_ineligible']).toContain(
      result.eligibility.classification
    )
    expect(result.eligibility.missingProfileFields.length).toBeGreaterThan(0)
  })

  it('feature flag fails closed by default', () => {
    clearPiEnv()
    expect(isProcurementIntelligenceEnabled()).toBe(false)
    expect(canAccessProcurementIntelligence({ uid: 'u1', userType: 'sme' })).toBe(false)
    expect(canAccessProcurementIntelligence({ uid: 'u1', userType: 'admin' })).toBe(false)
  })

  it('pilot allow-list works while global ENABLED is false', () => {
    clearPiEnv()
    process.env.PROCUREMENT_INTELLIGENCE_ENABLED = 'false'
    process.env.PROCUREMENT_INTELLIGENCE_PILOT_UIDS = 'pilot-a, pilot-b'
    expect(isProcurementIntelligenceEnabled()).toBe(false)
    expect(parseProcurementIntelligencePilotUids()).toEqual(['pilot-a', 'pilot-b'])
    expect(isProcurementIntelligencePilotUser('pilot-a')).toBe(true)
    expect(isProcurementIntelligencePilotUser('pilot-b')).toBe(true)
    expect(isProcurementIntelligencePilotUser('control-c')).toBe(false)
    expect(canAccessProcurementIntelligence({ uid: 'pilot-a', userType: 'admin' })).toBe(true)
    expect(canAccessProcurementIntelligence({ uid: 'pilot-b', userType: 'sme' })).toBe(true)
    expect(canAccessProcurementIntelligence({ uid: 'control-c', userType: 'sme' })).toBe(false)
    expect(canAccessProcurementIntelligence({ uid: 'admin-x', userType: 'admin' })).toBe(false)
  })

  it('empty pilot list denies everyone when globally disabled', () => {
    clearPiEnv()
    process.env.PROCUREMENT_INTELLIGENCE_ENABLED = 'false'
    process.env.PROCUREMENT_INTELLIGENCE_PILOT_UIDS = ''
    expect(isProcurementIntelligencePilotUser('anyone')).toBe(false)
    expect(canAccessProcurementIntelligence({ uid: 'anyone', userType: 'admin' })).toBe(false)
  })

  it('parses pilot UID edge cases', () => {
    expect(parseProcurementIntelligencePilotUids(undefined)).toEqual([])
    expect(parseProcurementIntelligencePilotUids('')).toEqual([])
    expect(parseProcurementIntelligencePilotUids('  , , ')).toEqual([])
    expect(parseProcurementIntelligencePilotUids('a,,b, c ')).toEqual(['a', 'b', 'c'])
  })

  it('global enable allows admins; SMEs still need allow-list', () => {
    clearPiEnv()
    process.env.PROCUREMENT_INTELLIGENCE_ENABLED = 'true'
    process.env.PROCUREMENT_INTELLIGENCE_PILOT_UIDS = 'sme-pilot'
    expect(canAccessProcurementIntelligence({ uid: 'admin-1', userType: 'admin' })).toBe(true)
    expect(canAccessProcurementIntelligence({ uid: 'sme-pilot', userType: 'sme' })).toBe(true)
    expect(canAccessProcurementIntelligence({ uid: 'sme-other', userType: 'sme' })).toBe(false)
  })
})
