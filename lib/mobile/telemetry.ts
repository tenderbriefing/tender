'use client'

import { mobilePost } from './mobileApi'

let sessionId: string | null = null

export function setMobileSessionId(id: string | null) {
  sessionId = id
}

export async function trackMobileEvent(
  event: string,
  metadata: Record<string, unknown> = {}
) {
  try {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    await mobilePost('/api/mobile/v1/telemetry', {
      event,
      metadata: { ...metadata, sessionId },
      sessionId,
    })
  } catch {
    /* non-blocking */
  }
}

export async function pingLocation(
  latitude: number,
  longitude: number,
  accuracy?: number,
  requestId?: string
) {
  try {
    await mobilePost('/api/mobile/v1/location', {
      latitude,
      longitude,
      accuracy,
      requestId,
      source: 'pwa',
    })
  } catch {
    /* non-blocking */
  }
}
