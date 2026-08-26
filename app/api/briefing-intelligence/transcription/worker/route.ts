import { NextRequest, NextResponse } from 'next/server'
import {
  isAutomationAuthorized,
  automationAuthErrorResponse,
} from '@/lib/automation/authorizeAutomation'
import { getFirebaseAdmin } from '@/lib/backend/firebaseAdmin'
import { processBriefingIntelligenceReport } from '@/lib/briefing-intelligence/processReport'
import { getTranscriptionJob } from '@/lib/briefing-intelligence/transcriptionJobs'
import { isBriefingAudioTranscriptionEnabled } from '@/lib/briefing-intelligence/featureFlag'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * Internal async worker for briefing audio transcription.
 * Auth: x-sync-secret / x-automation-secret (same as other automation routes).
 * Also accepts admin Bearer for manual ops retries.
 */
export async function POST(request: NextRequest) {
  let authorized = isAutomationAuthorized(request)
  if (!authorized) {
    const { verifyApiUser } = await import('@/lib/auth/verifyApiUser')
    const user = await verifyApiUser(request.headers.get('authorization'), ['admin'])
    if (!user) {
      return NextResponse.json(automationAuthErrorResponse(), { status: 401 })
    }
    authorized = true
  }

  if (!isBriefingAudioTranscriptionEnabled()) {
    return NextResponse.json(
      { success: false, error: 'Briefing audio transcription is disabled' },
      { status: 503 }
    )
  }

  let body: { jobId?: string; reportId?: string } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const jobId = String(body.jobId || '')
  if (!jobId) {
    return NextResponse.json({ success: false, error: 'jobId is required' }, { status: 400 })
  }

  const admin = getFirebaseAdmin()
  const db = admin.firestore()
  const job = await getTranscriptionJob(db, jobId)
  if (!job) {
    return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 })
  }

  // Honour backoff for retrying jobs.
  if (job.status === 'retrying' && job.nextAttemptAt) {
    const next = new Date(job.nextAttemptAt).getTime()
    if (Number.isFinite(next) && Date.now() < next) {
      const delay = Math.min(30_000, Math.max(0, next - Date.now()))
      await new Promise((r) => setTimeout(r, delay))
    }
  }

  console.info('[transcription] processing started', {
    requestId: job.requestId,
    transcriptionJobId: job.id,
    tenderId: job.tenderId,
    reportId: job.reportId,
    attempt: job.attempts + 1,
  })

  const result = await processBriefingIntelligenceReport({
    reportId: job.reportId,
    actorUid: 'system',
    actorRole: 'system',
    jobId: job.id,
    force: false,
  })

  if (result.ok) {
    console.info('[transcription] provider call completed / transcript stored', {
      requestId: job.requestId,
      transcriptionJobId: job.id,
      tenderId: job.tenderId,
      reportId: job.reportId,
      skipped: Boolean(result.skipped),
      transcriptId: result.transcriptId || null,
      needsContinuation: Boolean(result.needsContinuation),
    })

    if (result.needsContinuation) {
      const { enqueueTranscriptionWorker } = await import(
        '@/lib/briefing-intelligence/enqueueTranscription'
      )
      void enqueueTranscriptionWorker({
        jobId: job.id,
        reportId: job.reportId,
        requestId: job.requestId,
        tenderId: job.tenderId,
      })
    }

    return NextResponse.json({ success: true, data: result })
  }

  console.error('[transcription] permanent or retryable failure', {
    requestId: job.requestId,
    transcriptionJobId: job.id,
    tenderId: job.tenderId,
    reportId: job.reportId,
    error: result.error,
    retryable: result.retryable,
  })

  if (result.retryable) {
    const updated = await getTranscriptionJob(db, jobId)
    if (updated?.status === 'retrying') {
      console.info('[transcription] retry triggered', {
        requestId: job.requestId,
        transcriptionJobId: job.id,
        tenderId: job.tenderId,
        attempts: updated.attempts,
      })
      const { enqueueTranscriptionWorker } = await import(
        '@/lib/briefing-intelligence/enqueueTranscription'
      )
      void enqueueTranscriptionWorker({
        jobId: updated.id,
        reportId: updated.reportId,
        requestId: updated.requestId,
        tenderId: updated.tenderId,
      })
    }
  }

  return NextResponse.json(
    { success: false, error: result.error, retryable: result.retryable },
    { status: 500 }
  )
}
