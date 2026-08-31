import { describe, expect, it } from 'vitest'
import {
  BRIEFING_PRICE_CENTS,
  BRIEFING_PRICE_SHORT_LABEL,
  YOUTH_AGENT_PAYOUT_CENTS,
  GROSS_CONTRIBUTION_CENTS,
  LEGACY_BRIEFING_PRICE_CENTS,
  grossContributionForRevenueCents,
  briefingPriceSnapshotFields,
  formatBriefingPriceZar,
} from '@/lib/domain/briefingPricing'

describe('briefingPricing', () => {
  it('defines current commercial invariants in integer cents', () => {
    expect(BRIEFING_PRICE_CENTS).toBe(34900)
    expect(YOUTH_AGENT_PAYOUT_CENTS).toBe(20000)
    expect(GROSS_CONTRIBUTION_CENTS).toBe(14900)
    expect(GROSS_CONTRIBUTION_CENTS).toBe(BRIEFING_PRICE_CENTS - YOUTH_AGENT_PAYOUT_CENTS)
  })

  it('retains legacy price for historical records', () => {
    expect(LEGACY_BRIEFING_PRICE_CENTS).toBe(24900)
  })

  it('computes gross contribution from actual revenue', () => {
    expect(grossContributionForRevenueCents(34900)).toBe(14900)
    expect(grossContributionForRevenueCents(24900)).toBe(4900)
  })

  it('snapshot fields include pricing version', () => {
    const snap = briefingPriceSnapshotFields()
    expect(snap.briefingPriceCents).toBe(34900)
    expect(snap.paymentAmount).toBe(34900)
    expect(snap.currency).toBe('ZAR')
    expect(snap.pricingVersion).toBeTruthy()
  })

  it('formats ZAR without floating point storage', () => {
    expect(formatBriefingPriceZar()).toBe('R349.00')
    expect(BRIEFING_PRICE_SHORT_LABEL).toBe('R349')
  })
})
