'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { useAuth } from '@/components/providers/AuthProvider'
import { useNotificationsInbox } from '@/hooks/useNotificationsInbox'

export default function NotificationsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const { items, unreadCount, loading, markRead, markAllRead } = useNotificationsInbox(
    Boolean(user)
  )

  useEffect(() => {
    if (!authLoading && !user) router.push('/auth/signin')
  }, [authLoading, user, router])

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
            <p className="mt-1 text-sm text-slate-600">
              Briefing assignments, reports, and procurement sync alerts.
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => markAllRead()}
              className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50"
            >
              Mark all read
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner />
          </div>
        ) : (
          <ul className="mt-6 space-y-3">
            {items.map((n) => (
              <li
                key={n.id}
                className={`rounded-xl border p-4 ${
                  n.read ? 'border-slate-200 bg-white' : 'border-brand-200 bg-brand-50/30'
                }`}
              >
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => !n.read && markRead(n.id)}
                >
                  <p className="text-xs font-bold uppercase text-brand-700">
                    {n.eventType?.replace(/_/g, ' ') || 'Notification'}
                  </p>
                  <p className="mt-1 font-semibold text-slate-900">
                    {n.title || 'Procurement update'}
                  </p>
                  {n.createdAt && (
                    <p className="mt-2 text-xs text-slate-500">
                      {new Date(n.createdAt).toLocaleString('en-ZA')}
                    </p>
                  )}
                </button>
              </li>
            ))}
            {items.length === 0 && (
              <p className="text-center text-sm text-slate-500 py-12">No notifications.</p>
            )}
          </ul>
        )}
      </main>
      <Footer />
    </div>
  )
}
