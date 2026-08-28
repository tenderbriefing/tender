'use client'

import { useEffect, useRef } from 'react'

/** Run `callback` on an interval only while the document tab is visible. */
export function usePageVisibleInterval(callback: () => void, intervalMs: number, enabled = true) {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    if (!enabled || intervalMs <= 0) return

    let intervalId: ReturnType<typeof setInterval> | null = null

    const start = () => {
      if (intervalId !== null) return
      intervalId = setInterval(() => callbackRef.current(), intervalMs)
    }

    const stop = () => {
      if (intervalId === null) return
      clearInterval(intervalId)
      intervalId = null
    }

    const onVisibility = () => {
      if (document.hidden) stop()
      else start()
    }

    if (!document.hidden) start()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [enabled, intervalMs])
}
