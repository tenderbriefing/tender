import { describe, expect, it } from 'vitest'
import {
  amountsMatchCents,
  assertPaymentTransition,
  canTransitionPayment,
  CANONICAL_ATTENDANCE_FEE_CENTS,
  isAgentDispatchablePayment,
  normalizePaymentState,
  resolveAttendanceFeeCents,
} from '../../lib/domain/paymentLifecycle'

describe('paymentLifecycle', () => {
  it('uses canonical R349 fee by default', () => {
    delete process.env.ATTENDANCE_FEE_CENTS
    expect(resolveAttendanceFeeCents()).toBe(CANONICAL_ATTENDANCE_FEE_CENTS)
    expect(CANONICAL_ATTENDANCE_FEE_CENTS).toBe(34900)
  })

  it('allows pending → paid and rejects paid → pending', () => {
    expect(canTransitionPayment('pending', 'paid')).toBe(true)
    expect(canTransitionPayment('paid', 'pending')).toBe(false)
    expect(() => assertPaymentTransition('paid', 'pending')).toThrow(/Invalid payment transition/)
  })

  it('treats paid and not_required as dispatchable', () => {
    expect(isAgentDispatchablePayment('paid')).toBe(true)
    expect(isAgentDispatchablePayment('not_required')).toBe(true)
    expect(isAgentDispatchablePayment('pending')).toBe(false)
  })

  it('validates ITN amounts against expected cents', () => {
    expect(amountsMatchCents(34900, 349)).toBe(true)
    expect(amountsMatchCents(24900, 249)).toBe(true)
    expect(amountsMatchCents(34900, 348.99)).toBe(true)
    expect(amountsMatchCents(34900, 1)).toBe(false)
  })

  it('normalizes unknown payment states to pending', () => {
    expect(normalizePaymentState('weird')).toBe('pending')
    expect(normalizePaymentState('paid')).toBe('paid')
  })
})
