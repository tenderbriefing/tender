/**
 * P1 funnel instrumentation constants — keep in sync with
 * docs/analytics/revenue-funnel-specification.md
 */
export const FUNNEL_INSTRUMENTATION_VERSION = '2026-10-p1-funnel-v1'
/** SAST calendar date when pre-booking funnel events became reliable. */
export const FUNNEL_INSTRUMENTATION_EFFECTIVE_SAST = '2026-10-06'
export const FUNNEL_REPORTING_TIMEZONE = 'Africa/Johannesburg'

const DEDUPE_PREFIX = 'tb_funnel_dedupe_v1:'

export function funnelDedupeKey(eventName: string, entityKey: string): string {
  return `${DEDUPE_PREFIX}${eventName}:${entityKey}`
}

/** Returns true if this is the first emission in the browser session for the key. */
export function claimSessionDedupe(eventName: string, entityKey: string): boolean {
  if (typeof window === 'undefined') return true
  try {
    const key = funnelDedupeKey(eventName, entityKey)
    if (sessionStorage.getItem(key)) return false
    sessionStorage.setItem(key, '1')
    return true
  } catch {
    return true
  }
}
