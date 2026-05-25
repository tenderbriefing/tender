'use client'

import { useCallback, useEffect, useState } from 'react'
import { CloudOff, RefreshCw } from 'lucide-react'
import { getOfflineQueue } from '@/lib/mobile/offlineStore'
import { flushOfflineQueue } from '@/lib/mobile/syncService'

export default function OfflineStatusBar() {
  const [online, setOnline] = useState(true)
  const [pending, setPending] = useState(0)
  const [syncing, setSyncing] = useState(false)

  const refresh = useCallback(() => {
    setOnline(typeof navigator !== 'undefined' ? navigator.onLine : true)
    setPending(getOfflineQueue().length)
  }, [])

  useEffect(() => {
    refresh()
    const onOnline = () => {
      refresh()
      flushOfflineQueue().then(refresh)
    }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', refresh)
    const id = setInterval(refresh, 8000)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', refresh)
      clearInterval(id)
    }
  }, [refresh])

  if (online && pending === 0) return null

  return (
    <div
      className={`mt-2 flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs font-medium ${
        online ? 'bg-amber-50 text-amber-900' : 'bg-slate-800 text-white'
      }`}
    >
      <span className="flex items-center gap-1.5">
        <CloudOff className="h-3.5 w-3.5" />
        {!online ? 'Offline — actions queued' : `${pending} pending sync`}
      </span>
      {online && pending > 0 && (
        <button
          type="button"
          disabled={syncing}
          onClick={async () => {
            setSyncing(true)
            await flushOfflineQueue()
            refresh()
            setSyncing(false)
          }}
          className="inline-flex items-center gap-1 rounded-md bg-amber-200 px-2 py-1 text-amber-900"
        >
          <RefreshCw className={`h-3 w-3 ${syncing ? 'animate-spin' : ''}`} />
          Sync
        </button>
      )}
    </div>
  )
}
