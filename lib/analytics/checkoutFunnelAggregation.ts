/**
 * Checkout funnel aggregation — distinguish attempts from unique bookings.
 * Raw checkout_started events may repeat on PayFast retry; KPIs that mean
 * "bookings reaching checkout" MUST unique by requestId.
 */

export type CheckoutStartedLike = {
  eventName?: string
  metadata?: { requestId?: unknown } | null
  targetEntityId?: string | null
  timestamp?: string | null
}

export function requestIdFromCheckoutEvent(event: CheckoutStartedLike): string | null {
  const fromMeta =
    event.metadata && typeof event.metadata.requestId === 'string'
      ? event.metadata.requestId.trim()
      : ''
  if (fromMeta) return fromMeta
  const fromTarget =
    typeof event.targetEntityId === 'string' ? event.targetEntityId.trim() : ''
  return fromTarget || null
}

/**
 * CHECKOUT ATTEMPTS — raw count of checkout_started events (behavioural).
 */
export function countCheckoutAttempts(events: CheckoutStartedLike[]): number {
  return events.filter((e) => e.eventName === 'checkout_started' || e.eventName == null).length
}

/**
 * UNIQUE BOOKINGS REACHING CHECKOUT — distinct requestId (booking-level KPI).
 * Events without a requestId are counted separately as unresolved (not as unique bookings).
 */
export function uniqueCheckoutRequestIds(events: CheckoutStartedLike[]): {
  uniqueRequestIds: string[]
  uniqueBookingCount: number
  attemptCount: number
  missingRequestIdCount: number
} {
  const ids = new Set<string>()
  let missing = 0
  let attempts = 0
  for (const e of events) {
    if (e.eventName != null && e.eventName !== 'checkout_started') continue
    attempts += 1
    const id = requestIdFromCheckoutEvent(e)
    if (!id) {
      missing += 1
      continue
    }
    ids.add(id)
  }
  return {
    uniqueRequestIds: [...ids],
    uniqueBookingCount: ids.size,
    attemptCount: attempts,
    missingRequestIdCount: missing,
  }
}
