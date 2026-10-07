'use client'

import {
  claimSessionDedupe,
  FUNNEL_INSTRUMENTATION_VERSION,
} from '@/lib/analytics/funnelInstrumentation'

function deviceCategory(): string {
  if (typeof window === 'undefined') return 'unknown'
  const w = window.innerWidth
  if (w < 768) return 'mobile'
  if (w < 1024) return 'tablet'
  return 'desktop'
}

function getPublicSessionId(): string {
  if (typeof window === 'undefined') return 'server'
  try {
    const KEY = 'tb_product_session_id'
    let id = sessionStorage.getItem(KEY)
    if (!id) {
      id = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
      sessionStorage.setItem(KEY, id)
    }
    return id
  } catch {
    return `sess_${Date.now()}`
  }
}

/**
 * Public / unauthenticated funnel events (discovery + tender detail).
 * Fire-and-forget; session-deduped; never blocks UX.
 */
export type PublicFunnelEventName =
  | 'tender_listing_viewed'
  | 'tender_opened'
  | 'search_performed'
  | 'search_no_results'

export async function trackPublicFunnelEvent(
  eventName: PublicFunnelEventName,
  opts: {
    pagePath?: string
    tenderId?: string
    province?: string
    resultCount?: number
    queryLength?: number
  } = {}
): Promise<void> {
  const entityKey =
    eventName === 'tender_opened'
      ? String(opts.tenderId || '')
      : eventName === 'search_performed' || eventName === 'search_no_results'
        ? `${eventName}:${opts.queryLength ?? 0}:${opts.resultCount ?? 0}:${opts.province || ''}`
        : String(opts.pagePath || (typeof window !== 'undefined' ? window.location.pathname : ''))
  if (!entityKey) return
  // Search events may fire multiple times per session with different queries
  if (eventName !== 'search_performed' && eventName !== 'search_no_results') {
    if (!claimSessionDedupe(eventName, entityKey)) return
  } else if (!claimSessionDedupe(eventName, entityKey)) {
    return
  }

  try {
    await fetch('/api/product-events/funnel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventName,
        sessionId: getPublicSessionId(),
        pagePath: opts.pagePath || (typeof window !== 'undefined' ? window.location.pathname : undefined),
        deviceCategory: deviceCategory(),
        tenderId: opts.tenderId,
        province: opts.province,
        resultCount: opts.resultCount,
        queryLength: opts.queryLength,
        instrumentationVersion: FUNNEL_INSTRUMENTATION_VERSION,
      }),
      keepalive: true,
    })
  } catch {
    /* never block UX */
  }
}
