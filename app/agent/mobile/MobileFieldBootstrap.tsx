'use client'

import { useEffect } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { mobilePost } from '@/lib/mobile/mobileApi'
import { setMobileSessionId } from '@/lib/mobile/telemetry'
import { flushOfflineQueue } from '@/lib/mobile/syncService'
import { AGENT_FIELD_SW } from '@/lib/mobile/constants'
import { pingLocation, trackMobileEvent } from '@/lib/mobile/telemetry'

export default function MobileFieldBootstrap({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const push = usePushNotifications()

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register(AGENT_FIELD_SW).catch(() => undefined)
    }
  }, [])

  useEffect(() => {
    if (!user) return
    let pingTimer: ReturnType<typeof setInterval> | undefined

    ;(async () => {
      try {
        const session = await mobilePost<{ id: string }>('/api/mobile/v1/session', {
          platform: 'pwa',
          userAgent: navigator.userAgent,
          online: navigator.onLine,
        })
        setMobileSessionId(session.id)
        await trackMobileEvent('session_start', { platform: 'pwa' })
      } catch {
        /* non-blocking */
      }
      flushOfflineQueue()
      if (push.isSupported && push.permission === 'default') {
        push.requestPermission()
      }
    })()

    pingTimer = setInterval(() => {
      if (!navigator.geolocation) return
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          pingLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy)
        },
        () => undefined,
        { maximumAge: 120000, timeout: 15000 }
      )
    }, 120000)

    const onOnline = () => flushOfflineQueue()
    window.addEventListener('online', onOnline)

    return () => {
      if (pingTimer) clearInterval(pingTimer)
      window.removeEventListener('online', onOnline)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  return <>{children}</>
}
