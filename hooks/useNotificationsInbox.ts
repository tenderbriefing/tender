'use client'

import { useCallback, useEffect, useState } from 'react'
import { authFetch } from '@/lib/api/authenticatedFetch'

export interface InboxNotification {
  id: string
  userId?: string | null
  eventType?: string
  title?: string
  message?: string
  data?: Record<string, unknown>
  read?: boolean
  createdAt?: string
}

export function useNotificationsInbox(enabled = true) {
  const [items, setItems] = useState<InboxNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    try {
      const res = await authFetch('/api/notifications/inbox?limit=40')
      const json = await res.json()
      if (json.success) {
        setItems(json.data || [])
        setUnreadCount(json.unreadCount ?? 0)
      }
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    load()
    const interval = setInterval(load, 45000)
    return () => clearInterval(interval)
  }, [load])

  const markRead = async (notificationId: string) => {
    await authFetch('/api/notifications/inbox', {
      method: 'PATCH',
      body: JSON.stringify({ notificationId }),
    })
    setItems((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
    )
    setUnreadCount((c) => Math.max(0, c - 1))
  }

  const markAllRead = async () => {
    await authFetch('/api/notifications/inbox', {
      method: 'PATCH',
      body: JSON.stringify({ markAllRead: true }),
    })
    setItems((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnreadCount(0)
  }

  return { items, unreadCount, loading, refresh: load, markRead, markAllRead }
}
