'use client'

import { useMemo, useRef } from 'react'

export type TranscriptViewerSegment = {
  id: string
  speaker: string
  startSeconds: number
  endSeconds: number | null
  text: string
}

function formatTimestamp(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export default function BriefingTranscriptViewer({
  segments,
  fullText,
  audioUrl,
}: {
  segments: TranscriptViewerSegment[]
  fullText: string
  audioUrl?: string | null
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const copyable = useMemo(() => {
    if (segments.length) {
      return segments
        .map((seg) => `${formatTimestamp(seg.startSeconds)}\n${seg.speaker}\n${seg.text}`)
        .join('\n\n')
    }
    return fullText
  }, [segments, fullText])

  function seekTo(startSeconds: number) {
    const el = audioRef.current
    if (!el || !audioUrl) return
    el.currentTime = Math.max(0, startSeconds)
    void el.play().catch(() => {})
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">Briefing Transcript</h2>
        <button
          type="button"
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          onClick={() => void navigator.clipboard.writeText(copyable)}
        >
          Copy text
        </button>
      </div>

      {audioUrl ? (
        <audio ref={audioRef} controls preload="metadata" className="w-full" src={audioUrl}>
          <track kind="captions" />
        </audio>
      ) : null}

      <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
        {segments.length === 0 ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{fullText}</p>
        ) : (
          segments.map((seg) => (
            <div key={seg.id} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
              <button
                type="button"
                className={`text-left text-xs font-medium tabular-nums text-slate-500 ${
                  audioUrl ? 'hover:text-slate-800 underline-offset-2 hover:underline' : ''
                }`}
                onClick={() => seekTo(seg.startSeconds)}
                disabled={!audioUrl}
              >
                {formatTimestamp(seg.startSeconds)}
              </button>
              <div className="mt-0.5 text-sm font-semibold text-slate-900">{seg.speaker}</div>
              <p className="mt-1 text-sm leading-relaxed text-slate-800">{seg.text}</p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
