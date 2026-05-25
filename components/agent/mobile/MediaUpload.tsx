'use client'

import { useRef, useState } from 'react'
import { Camera, ImagePlus } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { mobileUpload } from '@/lib/mobile/mobileApi'
import { queueWhenOffline } from '@/lib/mobile/syncService'
import { trackMobileEvent } from '@/lib/mobile/telemetry'

const TYPES = [
  { id: 'venue', label: 'Venue photo' },
  { id: 'slides', label: 'Briefing slides' },
  { id: 'attendance', label: 'Attendance proof' },
  { id: 'site', label: 'Site condition' },
] as const

export default function MediaUpload({ requestId }: { requestId: string }) {
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const [mediaType, setMediaType] = useState<string>('venue')
  const [uploading, setUploading] = useState(false)

  const uploadFile = async (file: File) => {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('requestId', requestId)
      fd.append('mediaType', mediaType)
      fd.append('file', file)

      if (!navigator.onLine) {
        queueWhenOffline({
          itemType: 'upload',
          payload: { requestId, mediaType, fileName: file.name },
        })
        toast.success('Upload queued for sync')
        return
      }

      await mobileUpload('/api/mobile/v1/media', fd)
      await trackMobileEvent('photo_upload', { requestId, mediaType })
      toast.success('Uploaded')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) await uploadFile(file)
    e.target.value = ''
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="font-bold text-slate-900">Photos & proof</h3>
      <select
        value={mediaType}
        onChange={(e) => setMediaType(e.target.value)}
        className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
      >
        {TYPES.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </select>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onPick}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onPick}
      />
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={uploading}
          onClick={() => cameraRef.current?.click()}
          className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 text-sm font-semibold text-white"
        >
          <Camera className="h-4 w-4" />
          Camera
        </button>
        <button
          type="button"
          disabled={uploading}
          onClick={() => galleryRef.current?.click()}
          className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 text-sm font-semibold"
        >
          <ImagePlus className="h-4 w-4" />
          Gallery
        </button>
      </div>
    </div>
  )
}
