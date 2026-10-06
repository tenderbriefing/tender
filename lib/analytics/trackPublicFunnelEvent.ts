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
export async function trackPublicFunnelEvent(
  eventName: 'tender_listing_viewed' | 'tender_opened',
  opts: {
    pagePath?: string
    tenderId?: string
    province?: string
    resultCount?: number
  } = {}
): Promise<void> {
  const entityKey =
    eventName === 'tender_opened'
      ? String(opts.tenderId || '')
      : String(opts.pagePath || (typeof window !== 'undefined' ? window.location.pathname : ''))
  if (!entityKey) return
  if (!claimSessionDedupe(eventName, entityKey)) return

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
        instrumentationVersion: FUNNEL_INSTRUMENTATION_VERSION,
      }),
      keepalive: true,
    })
  } catch {
    /* never block UX */
  }
}
