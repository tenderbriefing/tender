'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { isFounderDashboardV2EnabledClient } from '@/lib/founder/access'

export function FounderV2Gate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const enabled = isFounderDashboardV2EnabledClient()

  useEffect(() => {
    if (!enabled) router.replace('/founder')
  }, [enabled, router])

  if (!enabled) return null
  return <>{children}</>
}
