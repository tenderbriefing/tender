import { describe, expect, it } from 'vitest'
import {
  BRIEFING_PRICE_CENTS,
  BRIEFING_PRICE_SHORT_LABEL,
  BRIEFING_PRICE_LABEL,
  YOUTH_AGENT_PAYOUT_CENTS,
  YOUTH_AGENT_PAYOUT_SHORT_LABEL,
  YOUTH_AGENT_PAYOUT_LABEL,
  GROSS_CONTRIBUTION_CENTS,
  GROSS_CONTRIBUTION_SHORT_LABEL,
  GROSS_CONTRIBUTION_LABEL,
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

  it('computes gross contribution from actual stored revenue', () => {
    expect(grossContributionForRevenueCents(34900)).toBe(14900)
    // Generic non-current snapshot — contribution uses stored revenue, not a fixed legacy price.
    expect(grossContributionForRevenueCents(27500)).toBe(7500)
  })

  it('snapshot fields include pricing version', () => {
    const snap = briefingPriceSnapshotFields()
    expect(snap.briefingPriceCents).toBe(34900)
    expect(snap.paymentAmount).toBe(34900)
    expect(snap.currency).toBe('ZAR')
    expect(snap.pricingVersion).toBeTruthy()
  })

  it('formats ZAR labels from canonical cents only', () => {
    expect(formatBriefingPriceZar()).toBe('R349.00')
    expect(BRIEFING_PRICE_LABEL).toBe('R349.00')
    expect(BRIEFING_PRICE_SHORT_LABEL).toBe('R349')
    expect(YOUTH_AGENT_PAYOUT_LABEL).toBe('R200.00')
    expect(YOUTH_AGENT_PAYOUT_SHORT_LABEL).toBe('R200')
    expect(GROSS_CONTRIBUTION_LABEL).toBe('R149.00')
    expect(GROSS_CONTRIBUTION_SHORT_LABEL).toBe('R149')
  })
})
