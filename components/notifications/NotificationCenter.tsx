'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import { useAuth } from '@/components/providers/AuthProvider'
import { useNotificationsInbox } from '@/hooks/useNotificationsInbox'

function notificationHref(n: { eventType?: string; data?: Record<string, unknown> }) {
  const data = n.data || {}
  if (data.requestId) return `/sme/requests/${data.requestId}`
  if (data.tenderId) return `/tenders/${data.tenderId}`
  if (n.eventType === 'briefing_report_submitted' && data.requestId) {
    return `/briefing-reports/upload?requestId=${data.requestId}`
  }
  if (n.eventType?.includes('sync') && n.eventType?.includes('fail')) return '/admin/integrations'
  return '/notifications'
}

function categoryLabel(eventType?: string) {
  switch (eventType) {
    case 'agent_accepted_briefing':
      return 'Briefing assigned'
    case 'briefing_report_submitted':
      return 'Report uploaded'
    case 'sme_requested_attendance':
      return 'Attendance request'
    case 'tender_closing_soon':
      return 'Closing soon'
    case 'new_briefing_found':
      return 'Compulsory briefing'
    default:
      return eventType?.replace(/_/g, ' ') || 'Update'
  }
}

export default function NotificationCenter() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const { items, unreadCount, loading, markRead, markAllRead, refresh } =
    useNotificationsInbox(Boolean(user))

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  if (!user) return null

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => {
          setOpen(!open)
          if (!open) refresh()
        }}
        className="relative inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:border-brand-200 hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(100vw-2rem,22rem)] rounded-xl border border-slate-200 bg-white shadow-lg sm:w-96">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-bold text-slate-900">Notifications</h2>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllRead()}
                className="text-xs font-semibold text-brand-700 hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-[min(60vh,320px)] overflow-y-auto">
            {loading && items.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">Loading…</p>
            ) : items.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">No notifications yet.</p>
            ) : (
              <ul>
                {items.map((n) => {
                  const href = notificationHref(n)
                  return (
                  <li
                    key={n.id}
                    className={`border-b border-slate-50 px-4 py-3 text-sm ${
                      n.read ? 'bg-white' : 'bg-brand-50/40'
                    }`}
                  >
                    <Link
                      href={href}
                      className="block w-full text-left"
                      onClick={() => {
                        if (!n.read) markRead(n.id)
                        setOpen(false)
                      }}
                    >
                      <span className="text-xs font-semibold uppercase text-brand-700">
                        {categoryLabel(n.eventType)}
                      </span>
                      <p className="mt-1 font-medium text-slate-900">
                        {n.title ||
                          (n.data as { title?: string })?.title ||
                          categoryLabel(n.eventType)}
                      </p>
                      {n.message && (
                        <p className="mt-0.5 line-clamp-2 text-slate-600">{n.message}</p>
                      )}
                      {n.createdAt && (
                        <p className="mt-1 text-xs text-slate-400">
                          {new Date(n.createdAt).toLocaleString('en-ZA')}
                        </p>
                      )}
                    </Link>
                  </li>
                  )
                })}
              </ul>
            )}
          </div>
          <div className="border-t border-slate-100 p-2">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="block rounded-lg py-2 text-center text-sm font-semibold text-brand-700 hover:bg-brand-50"
            >
              View all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
