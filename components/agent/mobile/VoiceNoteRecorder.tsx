'use client'

import { useRef, useState } from 'react'
import { Mic, Square, Play } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { mobileUpload } from '@/lib/mobile/mobileApi'
import { trackMobileEvent } from '@/lib/mobile/telemetry'

export default function VoiceNoteRecorder({ requestId }: { requestId: string }) {
  const [recording, setRecording] = useState(false)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [uploading, setUploading] = useState(false)
  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const audioRef = useRef<HTMLAudioElement>(null)

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream)
      chunksRef.current = []
      rec.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data)
      }
      rec.onstop = () => {
        const b = new Blob(chunksRef.current, { type: 'audio/webm' })
        setBlob(b)
        stream.getTracks().forEach((t) => t.stop())
      }
      mediaRef.current = rec
      rec.start()
      setRecording(true)
    } catch {
      toast.error('Microphone access denied')
    }
  }

  const stop = () => {
    mediaRef.current?.stop()
    setRecording(false)
  }

  const upload = async () => {
    if (!blob) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('requestId', requestId)
      fd.append('mediaType', 'voice')
      fd.append('file', blob, `voice-${Date.now()}.webm`)
      await mobileUpload('/api/mobile/v1/media', fd)
      await trackMobileEvent('voice_upload', { requestId })
      toast.success('Voice note uploaded')
      setBlob(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Voice upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="font-bold text-slate-900">Voice note</h3>
      <p className="mt-1 text-xs text-slate-500">Attach field notes to your briefing report</p>
      <div className="mt-3 flex gap-2">
        {!recording ? (
          <button
            type="button"
            onClick={start}
            className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 text-sm font-semibold text-white"
          >
            <Mic className="h-4 w-4" />
            Record
          </button>
        ) : (
          <button
            type="button"
            onClick={stop}
            className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 text-sm font-semibold text-white"
          >
            <Square className="h-4 w-4" />
            Stop
          </button>
        )}
        {blob && (
          <>
            <button
              type="button"
              onClick={() => {
                if (audioRef.current) {
                  audioRef.current.src = URL.createObjectURL(blob)
                  audioRef.current.play()
                }
              }}
              className="flex min-h-[48px] items-center justify-center rounded-xl border px-4"
            >
              <Play className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={uploading}
              onClick={upload}
              className="flex min-h-[48px] flex-1 items-center justify-center rounded-xl bg-brand-600 text-sm font-semibold text-white"
            >
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
          </>
        )}
      </div>
      <audio ref={audioRef} className="hidden" />
    </div>
  )
}
