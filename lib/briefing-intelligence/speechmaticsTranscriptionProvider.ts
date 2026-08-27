import type { BriefingReportContent } from './types'
import type {
  TenderContext,
  TranscriptionProvider,
  TranscriptionResult,
} from './transcriptionService'

function nowIso() {
  return new Date().toISOString()
}

function countWords(text: string): number | null {
  const t = String(text || '').trim()
  if (!t) return null
  return t.split(/\s+/).filter(Boolean).length
}

function getSpeechmaticsApiKey(): string {
  return (process.env.SPEECHMATICS_API_KEY || '').trim()
}

function speechmaticsBaseUrl(): string {
  const raw = String(process.env.SPEECHMATICS_API_URL || '').trim()
  if (raw) return raw.replace(/\/$/, '')
  // Default EU1 SaaS endpoint (Speechmatics Batch v2).
  return 'https://eu1.asr.api.speechmatics.com'
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

type SpeechmaticsResultItem = {
  type?: string
  start_time?: number
  end_time?: number
  alternatives?: Array<{
    content?: string
    confidence?: number
    speaker?: string
    language?: string
  }>
}

/**
 * Map Speechmatics json-v2 word/punctuation stream into timestamped segments.
 * Speaker labels stay neutral (Speaker N) — never invent names.
 */
export function mapSpeechmaticsTranscript(data: any): {
  transcriptText: string
  language: string | null
  confidence: number | null
  durationSeconds: number | null
  segments: TranscriptionResult['segments']
} {
  const results: SpeechmaticsResultItem[] = Array.isArray(data?.results) ? data.results : []
  const segments: TranscriptionResult['segments'] = []
  const confidences: number[] = []

  let currentSpeakerKey = '1'
  let currentTexts: string[] = []
  let currentStart: number | null = null
  let currentEnd: number | null = null
  let segIndex = 0

  const flush = () => {
    const text = currentTexts.join('').replace(/\s+/g, ' ').trim()
    if (!text) {
      currentTexts = []
      currentStart = null
      currentEnd = null
      return
    }
    segIndex += 1
    segments.push({
      id: `seg-${segIndex}`,
      speaker: `Speaker ${currentSpeakerKey}`,
      startSeconds: currentStart ?? 0,
      endSeconds: currentEnd,
      text,
    })
    currentTexts = []
    currentStart = null
    currentEnd = null
  }

  for (const item of results) {
    const alt = item.alternatives?.[0]
    if (!alt) continue
    const content = String(alt.content || '')
    if (!content) continue

    if (typeof alt.confidence === 'number') confidences.push(alt.confidence)

    const speakerRaw = String(alt.speaker || 'S1').replace(/^S/i, '') || '1'
    const isPunct = item.type === 'punctuation'

    if (!isPunct && speakerRaw !== currentSpeakerKey && currentTexts.length > 0) {
      flush()
      currentSpeakerKey = speakerRaw
    } else if (!isPunct) {
      currentSpeakerKey = speakerRaw
    }

    if (typeof item.start_time === 'number' && currentStart == null) {
      currentStart = item.start_time
    }
    if (typeof item.end_time === 'number') {
      currentEnd = item.end_time
    }

    if (isPunct) {
      currentTexts.push(content)
    } else {
      if (currentTexts.length > 0 && !/\s$/.test(currentTexts[currentTexts.length - 1] || '')) {
        currentTexts.push(' ')
      }
      currentTexts.push(content)
    }
  }
  flush()

  const transcriptText =
    String(data?.metadata?.transcript || '').trim() ||
    segments
      .map((s) => s.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()

  if (!transcriptText) {
    throw new Error('Speechmatics transcription returned empty text')
  }

  if (segments.length === 0) {
    segments.push({
      id: 'seg-1',
      speaker: 'Speaker 1',
      startSeconds: 0,
      endSeconds: typeof data?.metadata?.duration === 'number' ? data.metadata.duration : null,
      text: transcriptText,
    })
  }

  const avgConfidence =
    confidences.length > 0
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : null

  const language =
    typeof data?.metadata?.language_pack_info?.language_description === 'string'
      ? data.metadata.language_pack_info.language_description
      : typeof data?.results?.[0]?.alternatives?.[0]?.language === 'string'
        ? data.results[0].alternatives[0].language
        : null

  return {
    transcriptText,
    language,
    confidence: avgConfidence,
    durationSeconds: typeof data?.metadata?.duration === 'number' ? data.metadata.duration : null,
    segments,
  }
}

/**
 * Speechmatics Batch STT. Report extraction still uses OpenAI when that path runs.
 */
export class SpeechmaticsTranscriptionProvider implements TranscriptionProvider {
  private apiKey: string
  private baseUrl: string
  private language: string
  private operatingPoint: string
  private modelLabel: string

  constructor(opts?: { apiKey?: string }) {
    const apiKey = opts?.apiKey?.trim() || getSpeechmaticsApiKey()
    if (!apiKey) {
      throw new Error('SPEECHMATICS_API_KEY is required for briefing audio transcription')
    }
    this.apiKey = apiKey
    this.baseUrl = speechmaticsBaseUrl()
    this.language = String(process.env.SPEECHMATICS_LANGUAGE || 'en').trim() || 'en'
    this.operatingPoint =
      String(process.env.SPEECHMATICS_OPERATING_POINT || 'enhanced').trim() || 'enhanced'
    this.modelLabel = `speechmatics-${this.operatingPoint}`
  }

  private authHeaders(): Record<string, string> {
    return { Authorization: `Bearer ${this.apiKey}` }
  }

  private async createJob(audioBlob: Blob, fileName: string): Promise<string> {
    const fd = new FormData()
    fd.append(
      'config',
      JSON.stringify({
        type: 'transcription',
        transcription_config: {
          language: this.language,
          operating_point: this.operatingPoint,
          diarization: 'speaker',
        },
      })
    )
    fd.append('data_file', audioBlob, fileName)

    const res = await fetch(`${this.baseUrl}/v2/jobs`, {
      method: 'POST',
      headers: this.authHeaders(),
      body: fd as any,
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Speechmatics job create failed: ${res.status} ${text}`.slice(0, 2000))
    }

    const data: any = await res.json()
    const jobId = String(data?.id || '').trim()
    if (!jobId) {
      throw new Error('Speechmatics job create returned no id')
    }
    return jobId
  }

  private async fetchTranscript(jobId: string, maxWaitMs: number): Promise<any> {
    const deadline = Date.now() + maxWaitMs
    let lastStatus = 'unknown'

    while (Date.now() < deadline) {
      const remainingSec = Math.max(1, Math.ceil((deadline - Date.now()) / 1000))
      const waitSec = Math.min(60, remainingSec)

      const transcriptRes = await fetch(
        `${this.baseUrl}/v2/jobs/${encodeURIComponent(jobId)}/transcript?format=json-v2&wait=${waitSec}`,
        { headers: this.authHeaders() }
      )

      if (transcriptRes.ok) {
        return transcriptRes.json()
      }

      const statusRes = await fetch(
        `${this.baseUrl}/v2/jobs/${encodeURIComponent(jobId)}`,
        { headers: this.authHeaders() }
      )
      if (statusRes.ok) {
        const statusJson: any = await statusRes.json()
        lastStatus = String(statusJson?.job?.status || statusJson?.status || 'unknown')
        if (lastStatus === 'rejected' || lastStatus === 'deleted') {
          const detail = JSON.stringify(statusJson).slice(0, 500)
          throw new Error(`Speechmatics job ${lastStatus}: ${detail}`)
        }
        if (lastStatus === 'done') {
          // Transcript endpoint failed despite done — retry once without wait.
          const retry = await fetch(
            `${this.baseUrl}/v2/jobs/${encodeURIComponent(jobId)}/transcript?format=json-v2`,
            { headers: this.authHeaders() }
          )
          if (retry.ok) return retry.json()
          const text = await retry.text().catch(() => '')
          throw new Error(
            `Speechmatics transcript fetch failed after done: ${retry.status} ${text}`.slice(0, 2000)
          )
        }
      }

      if (transcriptRes.status === 401 || transcriptRes.status === 403) {
        const text = await transcriptRes.text().catch(() => '')
        throw new Error(`Speechmatics auth failed: ${transcriptRes.status} ${text}`.slice(0, 2000))
      }

      await sleep(2000)
    }

    throw new Error(
      `Speechmatics transcription timed out after ${maxWaitMs}ms (lastStatus=${lastStatus})`
    )
  }

  async transcribe(audioUrl: string): Promise<TranscriptionResult> {
    const audioRes = await fetch(audioUrl)
    if (!audioRes.ok) {
      throw new Error(`Failed to download audio for transcription: ${audioRes.status}`)
    }

    const contentType = audioRes.headers.get('content-type') || 'application/octet-stream'
    const arrayBuffer = await audioRes.arrayBuffer()
    const blob = new Blob([arrayBuffer as any], { type: contentType })

    const maxWaitMs = Number(process.env.SPEECHMATICS_MAX_WAIT_MS || 240_000)
    const jobId = await this.createJob(blob, 'audio')
    const data = await this.fetchTranscript(jobId, Number.isFinite(maxWaitMs) ? maxWaitMs : 240_000)
    const mapped = mapSpeechmaticsTranscript(data)

    return {
      provider: 'speechmatics',
      transcriptText: mapped.transcriptText,
      transcriptWordCount: countWords(mapped.transcriptText),
      language: mapped.language,
      confidence: mapped.confidence,
      completedAt: nowIso(),
      segments: mapped.segments,
      durationSeconds: mapped.durationSeconds,
      model: this.modelLabel,
      rawProviderPayload: {
        jobId,
        language: mapped.language,
        duration: mapped.durationSeconds,
        segmentCount: mapped.segments.length,
        operatingPoint: this.operatingPoint,
        segments: mapped.segments.map((s) => ({
          id: s.id,
          speaker: s.speaker,
          start: s.startSeconds,
          end: s.endSeconds,
          text: s.text,
        })),
      },
    }
  }

  /**
   * Intelligence extraction remains OpenAI (or meeting-minutes path).
   * Speechmatics is the sole STT provider — Whisper retired.
   */
  async extractIntelligence(
    transcript: string,
    tenderContext: TenderContext
  ): Promise<BriefingReportContent> {
    // Dynamic import avoids circular dependency with transcriptionService.
    const { OpenAITranscriptionProvider } = await import('./transcriptionService')
    return new OpenAITranscriptionProvider().extractIntelligence(transcript, tenderContext)
  }
}
