'use client'

import { useEffect, useRef } from 'react'
import { trackPublicFunnelEvent } from '@/lib/analytics/trackPublicFunnelEvent'

/**
 * Catalogue / hub discovery beacon.
 * Fires once per session per path when listings are actually present (qualified demand).
 */
export default function CatalogueDiscoveryBeacon({
  resultCount,
  province,
}: {
  resultCount: number
  province?: string | null
}) {
  const fired = useRef(false)

  useEffect(() => {
    if (fired.current) return
    if (!Number.isFinite(resultCount) || resultCount <= 0) return
    fired.current = true
    void trackPublicFunnelEvent('tender_listing_viewed', {
      pagePath: typeof window !== 'undefined' ? window.location.pathname : undefined,
      province: province || undefined,
      resultCount,
    })
  }, [resultCount, province])

  return null
}
