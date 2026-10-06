'use client'

import { authFetch } from '@/lib/api/authenticatedFetch'
import type { ProductEventName } from '@/lib/founder/eventSchema'
import {
  claimSessionDedupe,
  FUNNEL_INSTRUMENTATION_VERSION,
} from '@/lib/analytics/funnelInstrumentation'

const SESSION_KEY = 'tb_product_session_id'

const FUNNEL_EVENTS = new Set<ProductEventName>([
  'tender_listing_viewed',
  'tender_opened',
  'booking_intent',
  'booking_created',
  'checkout_started',
])

function getSessionId(): string {
  if (typeof window === 'undefined') return 'server'
  try {
    let id = sessionStorage.getItem(SESSION_KEY)
    if (!id) {
      id = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
      sessionStorage.setItem(SESSION_KEY, id)
    }
    return id
  } catch {
    return `sess_${Date.now()}`
  }
}

function deviceCategory(): string {
  if (typeof window === 'undefined') return 'unknown'
  const w = window.innerWidth
  if (w < 768) return 'mobile'
  if (w < 1024) return 'tablet'
  return 'desktop'
}

/** Fire-and-forget first-party product event (authenticated). */
export async function trackProductEvent(
  eventName: ProductEventName,
  opts: {
    pagePath?: string
    feature?: string
    targetEntityType?: string
    targetEntityId?: string
    targetUserId?: string
    metadata?: Record<string, unknown>
    /** When set, skip repeat emissions in this browser session for the same key. */
    dedupeEntityKey?: string
  } = {}
): Promise<void> {
  if (opts.dedupeEntityKey && !claimSessionDedupe(eventName, opts.dedupeEntityKey)) {
    return
  }

  const metadata = { ...(opts.metadata || {}) }
  if (FUNNEL_EVENTS.has(eventName) && metadata.instrumentationVersion == null) {
    metadata.instrumentationVersion = FUNNEL_INSTRUMENTATION_VERSION
  }

  try {
    await authFetch('/api/product-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventName,
        sessionId: getSessionId(),
        pagePath: opts.pagePath || (typeof window !== 'undefined' ? window.location.pathname : undefined),
        feature: opts.feature,
        targetEntityType: opts.targetEntityType,
        targetEntityId: opts.targetEntityId,
        targetUserId: opts.targetUserId,
        deviceCategory: deviceCategory(),
        metadata,
      }),
    })
  } catch {
    /* never block UX */
  }
}
