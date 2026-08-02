import { describe, expect, it } from 'vitest'
import { buildProcurementIntelligence } from '../../lib/procurement/intelligence/buildIntelligence'
import type { TenderBriefing } from '../../lib/tenderBriefing/types'
import {
  isProcurementIntelligenceEnabled,
  isProcurementIntelligencePilotUser,
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

describe('procurement intelligence phase 1', () => {
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
    delete process.env.PROCUREMENT_INTELLIGENCE_ENABLED
    delete process.env.PROCUREMENT_INTELLIGENCE_PILOT_UIDS
    expect(isProcurementIntelligenceEnabled()).toBe(false)
    process.env.PROCUREMENT_INTELLIGENCE_ENABLED = 'true'
    expect(isProcurementIntelligenceEnabled()).toBe(true)
    // Empty pilot list is deny-all for SMEs (controlled pilot)
    expect(isProcurementIntelligencePilotUser('u1')).toBe(false)
    process.env.PROCUREMENT_INTELLIGENCE_PILOT_UIDS = 'u2'
    expect(isProcurementIntelligencePilotUser('u1')).toBe(false)
    expect(isProcurementIntelligencePilotUser('u2')).toBe(true)
    delete process.env.PROCUREMENT_INTELLIGENCE_ENABLED
    delete process.env.PROCUREMENT_INTELLIGENCE_PILOT_UIDS
  })
})
