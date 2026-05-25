'use client'

import { useState } from 'react'
import { MapPin, LogIn, LogOut } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { mobilePost } from '@/lib/mobile/mobileApi'
import { queueWhenOffline } from '@/lib/mobile/syncService'
import { trackMobileEvent, pingLocation } from '@/lib/mobile/telemetry'

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export default function GpsCheckPanel({
  requestId,
  venueLat,
  venueLng,
  lastCheckIn,
}: {
  requestId: string
  venueLat?: number | null
  venueLng?: number | null
  lastCheckIn?: string | null
}) {
  const [loading, setLoading] = useState<'in' | 'out' | null>(null)
  const [position, setPosition] = useState<{
    lat: number
    lng: number
    accuracy: number
    distanceKm?: number
    at?: string
  } | null>(null)

  const capturePosition = (): Promise<GeolocationPosition> =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('GPS not supported'))
        return
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      })
    })

  const runCheck = async (eventType: 'check_in' | 'check_out') => {
    setLoading(eventType === 'check_in' ? 'in' : 'out')
    try {
      const pos = await capturePosition()
      const lat = pos.coords.latitude
      const lng = pos.coords.longitude
      const accuracy = pos.coords.accuracy
      const distanceKm =
        venueLat != null && venueLng != null
          ? haversineKm(lat, lng, venueLat, venueLng)
          : undefined

      setPosition({
        lat,
        lng,
        accuracy,
        distanceKm,
        at: new Date().toISOString(),
      })

      const payload = {
        requestId,
        latitude: lat,
        longitude: lng,
        accuracy,
        distanceKm,
      }

      const path =
        eventType === 'check_in' ? '/api/mobile/v1/check-in' : '/api/mobile/v1/check-out'

      if (!navigator.onLine) {
        queueWhenOffline({ itemType: eventType, payload })
        toast.success('Queued offline — will sync when online')
        await trackMobileEvent(eventType, { requestId, offline: true })
        return
      }

      const data = (await mobilePost(path, payload)) as {
        geofenceOk?: boolean
        message?: string
      }
      await pingLocation(lat, lng, accuracy, requestId)
      await trackMobileEvent(eventType, { requestId, distanceKm })

      if (data.geofenceOk === false) {
        toast.error(data.message || 'Outside briefing geofence')
      } else {
        toast.success(eventType === 'check_in' ? 'Checked in' : 'Checked out')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'GPS check failed')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-brand-700">
        <MapPin className="h-5 w-5" />
        <h3 className="font-bold text-slate-900">GPS attendance</h3>
      </div>
      {lastCheckIn && (
        <p className="mt-2 text-xs text-slate-500">Last check-in: {lastCheckIn}</p>
      )}
      {position && (
        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
          <div>
            <dt className="font-semibold text-slate-800">Accuracy</dt>
            <dd>{Math.round(position.accuracy)} m</dd>
          </div>
          {position.distanceKm != null && (
            <div>
              <dt className="font-semibold text-slate-800">To venue</dt>
              <dd>{position.distanceKm.toFixed(2)} km</dd>
            </div>
          )}
          {position.at && (
            <div className="col-span-2">
              <dt className="font-semibold text-slate-800">Timestamp</dt>
              <dd>{new Date(position.at).toLocaleString()}</dd>
            </div>
          )}
        </dl>
      )}
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          disabled={loading !== null}
          onClick={() => runCheck('check_in')}
          className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 font-semibold text-white disabled:opacity-60"
        >
          <LogIn className="h-4 w-4" />
          {loading === 'in' ? 'Locating…' : 'Check in'}
        </button>
        <button
          type="button"
          disabled={loading !== null}
          onClick={() => runCheck('check_out')}
          className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white font-semibold text-slate-800 disabled:opacity-60"
        >
          <LogOut className="h-4 w-4" />
          {loading === 'out' ? 'Locating…' : 'Check out'}
        </button>
      </div>
    </div>
  )
}
