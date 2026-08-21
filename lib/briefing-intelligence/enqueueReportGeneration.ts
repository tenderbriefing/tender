import { isBriefingAiReportGenerationEnabled } from './featureFlag'

/**
 * Fire-and-forget enqueue of the meeting-minutes report worker.
 * Never blocks transcription completion on PDF generation.
 */
export async function enqueueReportGenerationWorker(params: {
  jobId: string
  reportId: string
  requestId: string
  tenderId: string
}): Promise<void> {
  if (!isBriefingAiReportGenerationEnabled()) {
    console.info('[briefing-report] skip enqueue — feature flag off', {
      requestId: params.requestId,
      reportId: params.reportId,
      tenderId: params.tenderId,
      reportJobId: params.jobId,
    })
    return
  }

  const base =
    (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || '').replace(/\/$/, '') ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '')

  if (!base) {
    console.warn('[briefing-report] cannot enqueue — APP_URL unset', {
      requestId: params.requestId,
      reportId: params.reportId,
      tenderId: params.tenderId,
      reportJobId: params.jobId,
    })
    return
  }

  const secret = process.env.AUTOMATION_SECRET || process.env.SYNC_SECRET || ''
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (secret) {
    headers['x-sync-secret'] = secret
    headers['x-automation-secret'] = secret
  }

  console.info('[briefing-report] job created / enqueue worker', {
    requestId: params.requestId,
    reportId: params.reportId,
    tenderId: params.tenderId,
    reportJobId: params.jobId,
  })

  void fetch(`${base}/api/briefing-intelligence/report/worker`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ jobId: params.jobId, reportId: params.reportId }),
  }).catch((err) => {
    console.error('[briefing-report] worker enqueue failed', {
      requestId: params.requestId,
      reportId: params.reportId,
      tenderId: params.tenderId,
      reportJobId: params.jobId,
      error: err instanceof Error ? err.message : String(err),
    })
  })
}
