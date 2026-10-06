'use client'

import { useEffect } from 'react'
import { trackPublicFunnelEvent } from '@/lib/analytics/trackPublicFunnelEvent'

/** Once-per-session tender detail beacon (UNIQUE TENDER VIEW). */
export default function TenderDetailFunnelBeacon({
  tenderId,
  province,
}: {
  tenderId: string
  province?: string | null
}) {
  useEffect(() => {
    if (!tenderId) return
    void trackPublicFunnelEvent('tender_opened', {
      tenderId,
      province: province || undefined,
      pagePath: typeof window !== 'undefined' ? window.location.pathname : undefined,
    })
  }, [tenderId, province])

  return null
}
