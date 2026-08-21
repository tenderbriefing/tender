import { isBriefingAudioTranscriptionEnabled } from './featureFlag'

/**
 * Fire-and-forget enqueue of the transcription worker.
 * Never blocks the Youth Agent evidence upload response on Whisper completion.
 */
export async function enqueueTranscriptionWorker(params: {
  jobId: string
  reportId: string
  requestId: string
  tenderId: string
}): Promise<void> {
  if (!isBriefingAudioTranscriptionEnabled()) {
    console.info('[transcription] skip enqueue — feature flag off', {
      requestId: params.requestId,
      reportId: params.reportId,
      transcriptionJobId: params.jobId,
      tenderId: params.tenderId,
    })
    return
  }

  const base =
    (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || '').replace(/\/$/, '') ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '')

  if (!base) {
    console.warn('[transcription] cannot enqueue — APP_URL unset', {
      requestId: params.requestId,
      reportId: params.reportId,
      transcriptionJobId: params.jobId,
      tenderId: params.tenderId,
    })
    return
  }

  const secret =
    process.env.AUTOMATION_SECRET || process.env.SYNC_SECRET || ''
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (secret) {
    headers['x-sync-secret'] = secret
    headers['x-automation-secret'] = secret
  }

  console.info('[transcription] job created / enqueue worker', {
    requestId: params.requestId,
    reportId: params.reportId,
    transcriptionJobId: params.jobId,
    tenderId: params.tenderId,
  })

  // Do not await the full transcription — only kick the worker.
  void fetch(`${base}/api/briefing-intelligence/transcription/worker`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ jobId: params.jobId, reportId: params.reportId }),
  }).catch((err) => {
    console.error('[transcription] worker enqueue failed', {
      requestId: params.requestId,
      reportId: params.reportId,
      transcriptionJobId: params.jobId,
      tenderId: params.tenderId,
      error: err instanceof Error ? err.message : String(err),
    })
  })
}
