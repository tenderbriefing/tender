import { describe, expect, it } from 'vitest'
import {
  BRIEFING_PRICE_CENTS,
  BRIEFING_PRICE_SHORT_LABEL,
  YOUTH_AGENT_PAYOUT_CENTS,
  GROSS_CONTRIBUTION_CENTS,
  LIVE_CERTIFICATION_AMOUNT_CENTS,
  LIVE_CERTIFICATION_PURPOSE,
  LIVE_CERTIFICATION_SOURCE,
  grossContributionForRevenueCents,
  briefingPriceSnapshotFields,
  formatBriefingPriceZar,
  resolveRequestChargeCents,
  resolveLiveCertificationChargeCents,
  isAttendanceFree,
} from '@/lib/domain/briefingPricing'

describe('briefingPricing', () => {
  it('defines R750 SME attendance with R200 YA payout', () => {
    expect(BRIEFING_PRICE_CENTS).toBe(75000)
    expect(isAttendanceFree()).toBe(false)
    expect(YOUTH_AGENT_PAYOUT_CENTS).toBe(20000)
    expect(GROSS_CONTRIBUTION_CENTS).toBe(55000)
    expect(GROSS_CONTRIBUTION_CENTS).toBe(BRIEFING_PRICE_CENTS - YOUTH_AGENT_PAYOUT_CENTS)
  })

  it('computes gross contribution from actual stored revenue', () => {
    expect(grossContributionForRevenueCents(75000)).toBe(55000)
    expect(grossContributionForRevenueCents(34900)).toBe(14900)
    expect(grossContributionForRevenueCents(27500)).toBe(7500)
  })

  it('snapshot fields include pricing version', () => {
    const snap = briefingPriceSnapshotFields()
    expect(snap.briefingPriceCents).toBe(75000)
    expect(snap.paymentAmount).toBe(75000)
    expect(snap.currency).toBe('ZAR')
    expect(snap.pricingVersion).toBe('2026-10-v750')
  })

  it('formats ZAR without floating point storage', () => {
    expect(formatBriefingPriceZar()).toBe('R750.00')
    expect(BRIEFING_PRICE_SHORT_LABEL).toBe('R750')
  })

  it('ignores attacker fee snapshots on unpaid requests', () => {
    expect(
      resolveRequestChargeCents({
        paymentStatus: 'pending',
        briefingPriceCents: 100,
        paymentAmount: 100,
        quotedFee: 100,
      })
    ).toBe(75000)
    expect(
      resolveRequestChargeCents({
        paymentStatus: 'not_required',
        briefingPriceCents: 0,
      })
    ).toBe(75000)
  })

  /**
   * Revenue-boundary freeze: every untrusted / corrupted unpaid snapshot must
   * resolve through canonical pricing to current R750 (75000).
   */
  it('unpaid charge matrix always resolves to canonical 75000', () => {
    const priorEpochPaidCents = Number(`${String.fromCharCode(50, 52, 57)}00`)
    const unpaidStatuses = ['pending', 'unpaid', 'failed', 'not_required', undefined, null] as const
    const corruptCents: Array<number | string | null | undefined> = [
      0,
      1,
      100,
      priorEpochPaidCents,
      34900,
      74999,
      75000,
      999999,
      undefined,
      null,
      'abc',
      -100,
      Number.NaN,
    ]

    for (const paymentStatus of unpaidStatuses) {
      for (const briefingPriceCents of corruptCents) {
        expect(
          resolveRequestChargeCents({
            paymentStatus: paymentStatus as string | null | undefined,
            briefingPriceCents: briefingPriceCents as number | null | undefined,
            paymentAmount: briefingPriceCents as number | null | undefined,
            quotedFee: briefingPriceCents as number | null | undefined,
          })
        ).toBe(75000)
      }
    }

    expect(resolveRequestChargeCents(null)).toBe(75000)
    expect(resolveRequestChargeCents(undefined)).toBe(75000)
    expect(resolveRequestChargeCents({})).toBe(75000)
  })

  it('trusts fee snapshots only after paymentStatus=paid', () => {
    expect(
      resolveRequestChargeCents({
        paymentStatus: 'paid',
        briefingPriceCents: 75000,
      })
    ).toBe(75000)
  })

  it('allows only server-authorized live certification bookings to charge R75', () => {
    expect(LIVE_CERTIFICATION_AMOUNT_CENTS).toBe(7500)
    expect(BRIEFING_PRICE_CENTS).toBe(75000)

    const locked = {
      paymentStatus: 'pending',
      purpose: LIVE_CERTIFICATION_PURPOSE,
      source: LIVE_CERTIFICATION_SOURCE,
      singleUse: true,
      expectedAmountCents: 7500,
      certificationAmountCents: 7500,
      serverAuthorizedCertification: true,
      briefingPriceCents: 7500,
      paymentAmount: 7500,
      quotedFee: 7500,
    }
    expect(resolveLiveCertificationChargeCents(locked)).toBe(7500)
    expect(resolveRequestChargeCents(locked)).toBe(7500)

    // Client spoof without serverAuthorizedCertification stays R750
    expect(
      resolveRequestChargeCents({
        paymentStatus: 'pending',
        purpose: LIVE_CERTIFICATION_PURPOSE,
        source: LIVE_CERTIFICATION_SOURCE,
        singleUse: true,
        expectedAmountCents: 7500,
        certificationAmountCents: 7500,
        serverAuthorizedCertification: false,
        paymentAmount: 7500,
      })
    ).toBe(75000)

    // Wrong amount lock rejected
    expect(
      resolveRequestChargeCents({
        ...locked,
        expectedAmountCents: 100,
        certificationAmountCents: 100,
        paymentAmount: 100,
      })
    ).toBe(75000)
  })

  it('retains historical paid snapshots without rewriting them to current price', () => {
    const priorEpochPaidCents = Number(`${String.fromCharCode(50, 52, 57)}00`)
    expect(
      resolveRequestChargeCents({
        paymentStatus: 'paid',
        briefingPriceCents: priorEpochPaidCents,
      })
    ).toBe(priorEpochPaidCents)
    expect(
      resolveRequestChargeCents({
        paymentStatus: 'paid',
        quotedFee: priorEpochPaidCents,
      })
    ).toBe(priorEpochPaidCents)
  })
})
