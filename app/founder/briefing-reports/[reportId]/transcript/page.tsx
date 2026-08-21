'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { toast } from 'react-hot-toast'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import BriefingTranscriptViewer from '@/components/briefing/BriefingTranscriptViewer'
import { authFetch } from '@/lib/api/authenticatedFetch'

type TranscriptPayload = {
  reportId: string
  requestId: string
  tenderId: string
  reportStatus: string
  audioSignedUrl: string | null
  attendanceEvidenceCount: number
  job: {
    id: string
    status: string
    attempts: number
    maxAttempts: number
    errorCode: string | null
    errorMessage: string | null
    completedAt: string | null
    updatedAt: string
    provider: string
    detectedLanguage: string | null
    audioDurationSeconds: number | null
  } | null
  transcript: {
    id: string
    fullText: string
    segments: Array<{
      id: string
      speaker: string
      startSeconds: number
      endSeconds: number | null
      text: string
    }>
    language: string | null
    durationSeconds: number | null
    provider: string
    model: string | null
    status: string
    createdAt: string
    updatedAt: string
  } | null
}

export default function FounderBriefingTranscriptPage() {
  const params = useParams()
  const reportId = String(params?.reportId || '')
  const [loading, setLoading] = useState(true)
  const [retrying, setRetrying] = useState(false)
  const [data, setData] = useState<TranscriptPayload | null>(null)

  const load = useCallback(async () => {
    if (!reportId) return
    setLoading(true)
    try {
      const res = await authFetch(`/api/briefing-intelligence/reports/${reportId}/transcript`)
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to load transcript')
      }
      setData(json.data as TranscriptPayload)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [reportId])

  useEffect(() => {
    void load()
  }, [load])

  async function retry() {
    setRetrying(true)
    try {
      const res = await authFetch(`/api/briefing-intelligence/reports/${reportId}/transcript`, {
        method: 'POST',
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Retry failed')
      }
      toast.success('Transcription retry queued')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Retry failed')
    } finally {
      setRetrying(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-slate-600">Transcript not available.</p>
        <Link href="/founder/briefing-reports" className="mt-4 inline-block text-sm text-slate-900 underline">
          Back to reports
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/founder/briefing-reports" className="text-sm text-slate-500 hover:text-slate-800">
            ← Briefing reports
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">Transcript · {data.reportId}</h1>
          <p className="mt-1 text-sm text-slate-600">
            Request {data.requestId} · Tender {data.tenderId}
          </p>
        </div>
        <button
          type="button"
          disabled={retrying}
          onClick={() => void retry()}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {retrying ? 'Queuing…' : 'Retry transcription'}
        </button>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        <div>
          Recording uploaded: <strong>{data.audioSignedUrl ? 'Yes' : data.reportStatus}</strong>
        </div>
        <div>Attendance evidence files: {data.attendanceEvidenceCount}</div>
        <div>
          Transcription status:{' '}
          <strong>{data.job?.status || (data.transcript ? 'completed' : 'none')}</strong>
        </div>
        {data.job?.completedAt ? <div>Completed: {new Date(data.job.completedAt).toLocaleString('en-ZA')}</div> : null}
        {data.job?.errorMessage ? (
          <div className="mt-2 rounded border border-red-200 bg-red-50 p-2 text-red-900">
            <div className="font-medium">Operational error</div>
            <div className="text-xs">{data.job.errorCode}</div>
            <div className="mt-1 whitespace-pre-wrap text-xs">{data.job.errorMessage}</div>
            <div className="mt-1 text-xs">
              Attempts {data.job.attempts}/{data.job.maxAttempts}
            </div>
          </div>
        ) : null}
      </div>

      {data.transcript ? (
        <BriefingTranscriptViewer
          segments={data.transcript.segments}
          fullText={data.transcript.fullText}
          audioUrl={data.audioSignedUrl}
        />
      ) : (
        <p className="text-sm text-slate-600">
          No transcript stored yet. Use Retry transcription if the recording was received.
        </p>
      )}
    </div>
  )
}
