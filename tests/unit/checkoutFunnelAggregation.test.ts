import { describe, expect, it } from 'vitest'
import {
  countCheckoutAttempts,
  uniqueCheckoutRequestIds,
} from '@/lib/analytics/checkoutFunnelAggregation'

describe('checkout funnel aggregation', () => {
  const events = [
    { eventName: 'checkout_started', metadata: { requestId: 'req-1' } },
    { eventName: 'checkout_started', metadata: { requestId: 'req-1' } }, // retry
    { eventName: 'checkout_started', metadata: { requestId: 'req-2' } },
    { eventName: 'checkout_started', targetEntityId: 'req-3', metadata: {} },
    { eventName: 'checkout_started', metadata: {} }, // missing id
  ]

  it('counts CHECKOUT ATTEMPTS as raw events', () => {
    expect(countCheckoutAttempts(events)).toBe(5)
  })

  it('counts UNIQUE BOOKINGS REACHING CHECKOUT by distinct requestId', () => {
    const agg = uniqueCheckoutRequestIds(events)
    expect(agg.attemptCount).toBe(5)
    expect(agg.uniqueBookingCount).toBe(3)
    expect(agg.missingRequestIdCount).toBe(1)
    expect(agg.uniqueRequestIds.sort()).toEqual(['req-1', 'req-2', 'req-3'])
  })

  it('does not inflate unique bookings when the same request retries checkout', () => {
    const retries = [
      { eventName: 'checkout_started', metadata: { requestId: 'req-x' } },
      { eventName: 'checkout_started', metadata: { requestId: 'req-x' } },
      { eventName: 'checkout_started', metadata: { requestId: 'req-x' } },
    ]
    expect(uniqueCheckoutRequestIds(retries).uniqueBookingCount).toBe(1)
    expect(uniqueCheckoutRequestIds(retries).attemptCount).toBe(3)
  })
})
