import type { Bucket } from '@google-cloud/storage'
import type { Firestore, DocumentReference } from 'firebase-admin/firestore'
import type { BriefingIntelligenceReport } from './types'
import type { BriefingTranscriptionJob } from './transcriptionTypes'
import {
  completeTranscriptionJob,
  failTranscriptionJob,
} from './transcriptionJobs'
import { saveBriefingTranscript } from './transcriptStore'
import { handoffAfterTranscriptSaved, type TranscriptionMeta } from './transcriptionHandoff'
import { getTranscriptionProvider } from './transcriptionService'
import {
  isBriefingAudioTranscriptionEnabled,
  isBriefingAudioChunkingEnabled,
} from './featureFlag'
import { shouldUseChunkedTranscription } from './audioChunking/decision'
import { estimateDurationMsFromSize } from './audioChunking/ffmpegMedia'
import { processChunkedTranscription } from './processChunkedTranscription'

function nowIso() {
  return new Date().toISOString()
}

function computeWordCount(text: string): number | null {
  const t = String(text || '').trim()
  if (!t) return null
  return t.split(/\s+/).filter(Boolean).length
}

export type ProcessReportResult =
  | { ok: true; reportId: string; skipped?: boolean; transcriptId?: string; needsContinuation?: boolean }
  | { ok: false; reportId: string; error: string; retryable: boolean }

type AdminBucket = Bucket

/**
 * Direct single-request Whisper transcription (short audio path).
 */
async function processDirectTranscription(params: {
  db: Firestore
  bucket: AdminBucket
  docRef: DocumentReference
  report: BriefingIntelligenceReport
  reportId: string
  jobId: string
  actorUid: string
  actorRole: 'admin' | 'system'
  nextAttempts: number
  transcriptionMode: 'direct'
}): Promise<ProcessReportResult> {
  const { db, bucket, docRef, report, reportId, jobId, actorUid, actorRole, nextAttempts } =
    params

  const file = bucket.file(report.audioFileRef!)
  const [audioUrl] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + 60 * 60 * 1000,
  })

  const provider = getTranscriptionProvider()
  const transcription = await provider.transcribe(audioUrl)
  const segments =
    Array.isArray(transcription.segments) && transcription.segments.length > 0
      ? transcription.segments
      : [
          {
            id: 'seg-1',
            speaker: 'Speaker 1',
            startSeconds: 0,
            endSeconds: transcription.durationSeconds ?? null,
            text: transcription.transcriptText,
          },
        ]

  const transcriptPath = `briefing-intelligence/${reportId}/transcripts/raw-${Date.now()}.json`
  await bucket.file(transcriptPath).save(
    Buffer.from(
      JSON.stringify(
        transcription.rawProviderPayload || {
          text: transcription.transcriptText,
          segments,
          language: transcription.language,
          duration: transcription.durationSeconds,
        }
      )
    ),
    {
      contentType: 'application/json',
      metadata: { reportId, requestId: report.requestId },
      resumable: false,
    }
  )

  const transcriptRecord = await saveBriefingTranscript({
    db,
    reportId,
    requestId: report.requestId,
    tenderId: report.tenderId,
    agentId: report.agentId,
    smeId: report.smeId,
    transcriptionJobId: jobId,
    sourceAudioPath: report.audioFileRef!,
    language: transcription.language,
    durationSeconds: transcription.durationSeconds ?? null,
    fullText: transcription.transcriptText,
    segments,
    provider: transcription.provider,
    model: transcription.model ?? null,
    confidence: transcription.confidence,
    rawProviderResponseRef: transcriptPath,
  })

  await completeTranscriptionJob({
    db,
    jobId,
    transcriptId: transcriptRecord.id,
    detectedLanguage: transcription.language,
    audioDurationSeconds: transcription.durationSeconds ?? null,
  })

  const transcriptionMeta: TranscriptionMeta = {
    provider: transcription.provider,
    rawTranscriptRef: transcriptPath,
    transcriptWordCount:
      transcription.transcriptWordCount ?? computeWordCount(transcription.transcriptText),
    language: transcription.language,
    confidence: transcription.confidence,
    completedAt: transcription.completedAt,
    transcriptId: transcriptRecord.id,
    segmentCount: segments.length,
    durationSeconds: transcription.durationSeconds ?? null,
    transcriptionMode: 'direct',
  }

  await docRef.set(
    {
      pipelineDiagnostics: {
        currentStage: 'transcription_complete',
        transcriptionMode: 'direct',
        updatedAt: nowIso(),
      },
    },
    { merge: true }
  )

  await handoffAfterTranscriptSaved({
    db,
    docRef,
    report,
    reportId,
    jobId,
    actorUid,
    actorRole,
    nextAttempts,
    transcriptRecord,
    transcriptionMeta,
    fullText: transcription.transcriptText,
    segments,
    durationSeconds: transcription.durationSeconds ?? null,
    provider: transcription.provider,
    model: transcription.model ?? null,
  })

  return { ok: true, reportId, transcriptId: transcriptRecord.id }
}

/**
 * Core processing: claim job → direct or chunked transcription → report handoff.
 */
export async function processBriefingIntelligenceReport(params: {
  reportId: string
  actorUid: string
  actorRole: 'admin' | 'system'
  force?: boolean
  jobId?: string
  existingJob?: BriefingTranscriptionJob | null
}): Promise<ProcessReportResult> {
  const { reportId, actorUid, actorRole, force = false } = params
  const { getFirebaseAdmin } = await import('@/lib/backend/firebaseAdmin')
  const admin = getFirebaseAdmin()
  const db = admin.firestore()
  const docRef = db.collection('briefingIntelligenceReports').doc(reportId)

  const snap = await docRef.get()
  if (!snap.exists) {
    return { ok: false, reportId, error: 'Report not found', retryable: false }
  }

  const report = snap.data() as BriefingIntelligenceReport

  if (report.status === 'delivered') {
    return { ok: true, reportId, skipped: true }
  }
  if (!force && ['draft_report', 'agent_review', 'final'].includes(report.status)) {
    return { ok: true, reportId, skipped: true }
  }

  const { claimTranscriptionJob, getTranscriptionJob, transcriptionJobIdForReport } =
    await import('./transcriptionJobs')
  const { logBriefingIntelligenceAuditEvent } = await import('./auditService')
  const { syncSlaForReport } = await import('./slaService')

  const jobId = params.jobId || transcriptionJobIdForReport(reportId)
  const existingJob = params.existingJob ?? (await getTranscriptionJob(db, jobId))
  let claimed = null as Awaited<ReturnType<typeof claimTranscriptionJob>>

  if (existingJob) {
    if (!force && existingJob.status === 'completed' && existingJob.transcriptId) {
      return { ok: true, reportId, skipped: true, transcriptId: existingJob.transcriptId }
    }
    if (!force && existingJob.status === 'processing') {
      const lease = existingJob.processingLeaseExpiresAt
      if (lease && Date.now() < new Date(lease).getTime()) {
        return { ok: true, reportId, skipped: true }
      }
    }
    claimed = await claimTranscriptionJob(db, jobId)
    if (!claimed && !force) {
      return { ok: true, reportId, skipped: true }
    }
  }

  const job = claimed || existingJob
  const now = nowIso()
  const nextAttempts = (report.processingAttempts || 0) + 1
  await docRef.set(
    {
      status: 'processing',
      processingStartedAt: now,
      updatedAt: now,
      processingAttempts: nextAttempts,
      lastError: null,
    },
    { merge: true }
  )

  await syncSlaForReport({ db, reportId, now: new Date(now) })

  await logBriefingIntelligenceAuditEvent({
    db,
    eventType: 'processing_started',
    reportId,
    requestId: report.requestId,
    agentId: report.agentId,
    smeId: report.smeId,
    actorUid,
    actorRole,
    nextStatus: 'processing',
    meta: {
      processingAttempts: nextAttempts,
      jobId,
      transcriptionEnabled: isBriefingAudioTranscriptionEnabled(),
      chunkingEnabled: isBriefingAudioChunkingEnabled(),
    },
  })

  try {
    if (!report.audioFileRef) {
      throw Object.assign(new Error('Missing audioFileRef on report'), { code: 'missing_audio' })
    }

    const bucket = admin.storage().bucket()
    let sourceSizeBytes = Number(job?.audioSizeBytes || 0)
    if (!sourceSizeBytes && report.audioFileSizeMb) {
      sourceSizeBytes = Math.round(Number(report.audioFileSizeMb) * 1024 * 1024)
    }
    try {
      const [metadata] = await bucket.file(report.audioFileRef).getMetadata()
      sourceSizeBytes = Number(metadata.size || sourceSizeBytes || 0)
    } catch {
      /* tests / partial mocks — fall back to job/report size hints */
    }

    let useChunked = false
    if (isBriefingAudioChunkingEnabled()) {
      const estimatedDurationMs = estimateDurationMsFromSize(sourceSizeBytes)
      try {
        const decision = shouldUseChunkedTranscription({
          chunkingFlagEnabled: true,
          probe: {
            durationMs: estimatedDurationMs,
            sizeBytes: sourceSizeBytes,
            codec: null,
            bitrateKbps: null,
          },
        })
        useChunked = decision.mode === 'chunked'
        console.info('[transcription] direct-vs-chunked decision', {
          reportId,
          mode: decision.mode,
          reason: decision.reason,
          sizeBytes: sourceSizeBytes,
          estimatedDurationMs,
        })
      } catch (decisionErr) {
        throw decisionErr
      }
    }

    if (useChunked && job) {
      const chunked = await processChunkedTranscription({
        db,
        bucket,
        docRef,
        report,
        reportId,
        job,
        jobId,
        actorUid,
        actorRole,
        nextAttempts,
        sourceSizeBytes,
        leaseOwner: jobId,
      })
      return chunked
    }

    return await processDirectTranscription({
      db,
      bucket,
      docRef,
      report,
      reportId,
      jobId,
      actorUid,
      actorRole,
      nextAttempts,
      transcriptionMode: 'direct',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const code =
      error && typeof error === 'object' && 'code' in error
        ? String((error as { code?: string }).code || 'transcription_failed')
        : 'transcription_failed'
    const retryable =
      !['missing_audio', 'audio_too_long', 'invalid_audio'].includes(code) &&
      (code === 'chunk_retry' ||
        !['chunk_failed'].includes(code))

    const failedJob = await failTranscriptionJob({
      db,
      jobId,
      errorCode: code,
      errorMessage: message,
      retry: retryable,
    })

    const failNow = nowIso()
    await docRef.set(
      {
        status: 'processing_failed',
        lastError: message.slice(0, 2000),
        updatedAt: failNow,
        reportContent: null,
        transcription: null,
        draftReadyAt: null,
      },
      { merge: true }
    )

    await logBriefingIntelligenceAuditEvent({
      db,
      eventType: 'failed',
      reportId,
      requestId: report.requestId,
      agentId: report.agentId,
      smeId: report.smeId,
      actorUid,
      actorRole,
      error: message,
      meta: {
        jobId,
        jobStatus: failedJob?.status || null,
        attempts: failedJob?.attempts || null,
      },
    })
    await syncSlaForReport({ db, reportId, now: new Date(failNow) })

    return { ok: false, reportId, error: message, retryable: failedJob?.status === 'retrying' }
  }
}

export { fetchAttendanceAndTenderContext } from './tenderContext'
