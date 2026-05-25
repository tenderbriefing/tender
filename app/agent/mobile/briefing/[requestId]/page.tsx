'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/components/providers/AuthProvider'
import MobileShell from '@/components/agent/mobile/MobileShell'
import GpsCheckPanel from '@/components/agent/mobile/GpsCheckPanel'
import MediaUpload from '@/components/agent/mobile/MediaUpload'
import VoiceNoteRecorder from '@/components/agent/mobile/VoiceNoteRecorder'
import WhatsAppActions from '@/components/agent/mobile/WhatsAppActions'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { mobileGet } from '@/lib/mobile/mobileApi'
import { Navigation, FileText } from 'lucide-react'

type BriefingPayload = {
  request: Record<string, unknown>
  tender: Record<string, unknown>
  aiSummary?: { summary?: string; keyPoints?: string[] } | null
  gpsEvents?: Array<{ eventType?: string; createdAt?: string }>
  coordinates?: { lat: number | null; lng: number | null }
}

export default function AgentMobileBriefingPage() {
  const { requestId } = useParams<{ requestId: string }>()
  const { user, userProfile, loading } = useAuth()
  const router = useRouter()
  const [data, setData] = useState<BriefingPayload | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!requestId) return
    try {
      const payload = await mobileGet<BriefingPayload>(`/api/mobile/v1/briefing/${requestId}`)
      setData(payload)
      setErr(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Load failed')
    }
  }, [requestId])

  useEffect(() => {
    if (!loading && !user) router.replace('/agent/mobile/login')
    if (!loading && userProfile && userProfile.userType !== 'youth-agent') {
      router.replace('/agent/dashboard')
    }
  }, [user, userProfile, loading, router])

  useEffect(() => {
    if (user && requestId) load()
  }, [user, requestId, load])

  if (loading || !user) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  const req = data?.request || {}
  const tender = data?.tender || {}
  const lat = data?.coordinates?.lat
  const lng = data?.coordinates?.lng
  const navUrl =
    lat != null && lng != null
      ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          String(req.briefingVenue || tender.briefingVenue || '')
        )}`

  const lastIn = data?.gpsEvents?.find((e) => e.eventType === 'check_in')?.createdAt

  return (
    <MobileShell title={String(req.tenderNumber || 'Briefing')}>
      {err && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{err}</p>}
      {!data ? (
        <LoadingSpinner />
      ) : (
        <div className="space-y-4">
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="font-bold text-slate-900">{String(tender.title || req.tenderTitle)}</h2>
            <p className="mt-1 text-sm text-slate-600">{String(tender.department || req.department)}</p>
            <p className="mt-2 text-sm">
              <span className="font-semibold">Venue:</span> {String(req.briefingVenue || tender.briefingVenue || '—')}
            </p>
            <p className="text-sm">
              <span className="font-semibold">When:</span>{' '}
              {String(req.briefingDate || tender.briefingDate)} {String(req.briefingTime || '')}
            </p>
            <p className="mt-2 text-xl font-bold text-brand-700">
              R{((Number(req.paymentAmount) || 24900) / 100).toFixed(2)}
            </p>
            <a
              href={navUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-brand-600 font-semibold text-white"
            >
              <Navigation className="h-4 w-4" />
              Navigate to venue
            </a>
          </section>

          {data.aiSummary?.summary && (
            <section className="rounded-2xl border border-brand-100 bg-brand-50/50 p-4">
              <h3 className="font-bold text-slate-900">AI tender summary</h3>
              <p className="mt-2 text-sm text-slate-700">{data.aiSummary.summary}</p>
            </section>
          )}

          <WhatsAppActions
            requestId={requestId}
            tenderNumber={String(req.tenderNumber || '')}
          />

          <GpsCheckPanel
            requestId={requestId}
            venueLat={lat}
            venueLng={lng}
            lastCheckIn={lastIn || null}
          />

          <MediaUpload requestId={requestId} />
          <VoiceNoteRecorder requestId={requestId} />

          <Link
            href={`/briefing-reports/upload?requestId=${requestId}`}
            className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand-300 bg-white font-bold text-brand-700"
          >
            <FileText className="h-5 w-5" />
            Upload briefing report
          </Link>
        </div>
      )}
    </MobileShell>
  )
}
