'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/components/providers/AuthProvider'
import MobileShell from '@/components/agent/mobile/MobileShell'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { mobileGet } from '@/lib/mobile/mobileApi'
import { authFetch } from '@/lib/api/authenticatedFetch'
import { toast } from 'react-hot-toast'
import { Clock, MapPin, ChevronRight } from 'lucide-react'
import WhatsAppActions from '@/components/agent/mobile/WhatsAppActions'

type DispatchItem = {
  requestId: string
  tenderNumber?: string
  tenderTitle?: string
  province?: string
  briefingDate?: string
  briefingTime?: string
  payoutZar?: string
  etaMinutes?: number | null
  distanceKm?: number | null
  urgency?: string
  status?: string
  canAccept?: boolean
  assignedToMe?: boolean
}

type DispatchBoard = {
  assignments: DispatchItem[]
  opportunities: DispatchItem[]
}

function UrgencyBadge({ urgency }: { urgency?: string }) {
  if (urgency === 'high') {
    return (
      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800">
        Urgent
      </span>
    )
  }
  return (
    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
      {urgency || 'normal'}
    </span>
  )
}

function DispatchCard({
  item,
  onAccept,
  onDecline,
}: {
  item: DispatchItem
  onAccept: (id: string) => void
  onDecline: (id: string) => void
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold text-slate-900">{item.tenderNumber || item.requestId}</p>
          <p className="text-sm text-slate-600 line-clamp-2">{item.tenderTitle}</p>
        </div>
        <UrgencyBadge urgency={item.urgency} />
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
        <span className="flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5" />
          {item.province || '—'}
          {item.distanceKm != null ? ` · ${item.distanceKm} km` : ''}
        </span>
        {item.etaMinutes != null && (
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            ETA {item.etaMinutes} min
          </span>
        )}
      </div>
      <p className="mt-2 text-lg font-bold text-brand-700">{item.payoutZar || 'R249.00'}</p>
      <p className="text-xs text-slate-500">
        {item.briefingDate} {item.briefingTime ? `· ${item.briefingTime}` : ''}
      </p>
      <div className="mt-3 flex gap-2">
        {item.canAccept && (
          <>
            <button
              type="button"
              onClick={() => onAccept(item.requestId)}
              className="min-h-[44px] flex-1 rounded-xl bg-brand-600 font-semibold text-white"
            >
              Accept
            </button>
            <button
              type="button"
              onClick={() => onDecline(item.requestId)}
              className="min-h-[44px] rounded-xl border border-slate-300 px-4 font-semibold text-slate-700"
            >
              Decline
            </button>
          </>
        )}
        <Link
          href={`/agent/mobile/briefing/${item.requestId}`}
          className={`inline-flex min-h-[44px] items-center justify-center gap-1 rounded-xl font-semibold text-brand-700 ${
            item.canAccept ? '' : 'flex-1 bg-brand-50'
          }`}
        >
          Open
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </article>
  )
}

export default function AgentMobileDispatchPage() {
  const { user, userProfile, loading } = useAuth()
  const router = useRouter()
  const [board, setBoard] = useState<DispatchBoard | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(true)

  const load = useCallback(async () => {
    setRefreshing(true)
    try {
      const data = await mobileGet<DispatchBoard>('/api/mobile/v1/dispatch')
      setBoard(data)
      setLoadError(null)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load dispatch')
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (!loading && !user) router.replace('/agent/mobile/login')
    if (!loading && userProfile && userProfile.userType !== 'youth-agent') {
      router.replace('/agent/dashboard')
    }
  }, [user, userProfile, loading, router])

  useEffect(() => {
    if (user) load()
    const id = setInterval(load, 60000)
    return () => clearInterval(id)
  }, [user, load])

  const accept = async (requestId: string) => {
    if (!user) return
    try {
      const res = await authFetch(`/api/agents/${user.uid}/accept`, {
        method: 'POST',
        body: JSON.stringify({ requestId }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      toast.success('Assignment accepted')
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Accept failed')
    }
  }

  const decline = async (requestId: string) => {
    if (!user) return
    try {
      const res = await authFetch(`/api/agents/${user.uid}/decline`, {
        method: 'POST',
        body: JSON.stringify({ requestId, reason: 'mobile_decline' }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      toast.success('Declined')
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Decline failed')
    }
  }

  if (loading || !user) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <MobileShell title="Live dispatch">
      <div className="mb-4">
        <WhatsAppActions />
      </div>
      {refreshing && !board ? (
        <LoadingSpinner />
      ) : loadError ? (
        <p className="rounded-lg bg-red-50 p-4 text-sm text-red-800">{loadError}</p>
      ) : (
        <div className="space-y-6">
          <section>
            <h2 className="mb-2 text-sm font-bold uppercase text-slate-500">Active assignments</h2>
            <div className="space-y-3">
              {(board?.assignments || []).length === 0 ? (
                <p className="text-sm text-slate-500">No active assignments</p>
              ) : (
                board?.assignments.map((item) => (
                  <DispatchCard key={item.requestId} item={item} onAccept={accept} onDecline={decline} />
                ))
              )}
            </div>
          </section>
          <section>
            <h2 className="mb-2 text-sm font-bold uppercase text-slate-500">Nearby / available</h2>
            <div className="space-y-3">
              {(board?.opportunities || []).length === 0 ? (
                <p className="text-sm text-slate-500">No open briefings right now</p>
              ) : (
                board?.opportunities.map((item) => (
                  <DispatchCard key={item.requestId} item={item} onAccept={accept} onDecline={decline} />
                ))
              )}
            </div>
          </section>
        </div>
      )}
    </MobileShell>
  )
}
