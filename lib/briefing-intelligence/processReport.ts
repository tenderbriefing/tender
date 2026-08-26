import { getFirebaseAdmin } from '@/lib/backend/firebaseAdmin'
import type { BriefingIntelligenceReport, BriefingReportContent } from '@/lib/briefing-intelligence/types'
import { getTranscriptionProvider } from '@/lib/briefing-intelligence/transcriptionService'
import { logBriefingIntelligenceAuditEvent } from '@/lib/briefing-intelligence/auditService'
import { syncSlaForReport } from '@/lib/briefing-intelligence/slaService'
import { saveBriefingTranscript } from '@/lib/briefing-intelligence/transcriptStore'
import {
  claimTranscriptionJob,
  completeTranscriptionJob,
  failTranscriptionJob,
  getTranscriptionJob,
  transcriptionJobIdForReport,
} from '@/lib/briefing-intelligence/transcriptionJobs'
import {
  isBriefingAudioTranscriptionEnabled,
  isBriefingAiReportGenerationEnabled,
} from '@/lib/briefing-intelligence/featureFlag'
import { fetchAttendanceAndTenderContext } from '@/lib/briefing-intelligence/tenderContext'

export { fetchAttendanceAndTenderContext } from '@/lib/briefing-intelligence/tenderContext'

function nowIso() {
  return new Date().toISOString()
}

function computeWordCount(text: string): number | null {
  const t = String(text || '').trim()
  if (!t) return null
  return t.split(/\s+/).filter(Boolean).length
}

export type ProcessReportResult =
  | { ok: true; reportId: string; skipped?: boolean; transcriptId?: string }
  | { ok: false; reportId: string; error: string; retryable: boolean }

/**
 * Core processing: claim job (optional) → Whisper → store transcript → extract → draft_report.
 * Evidence submission remains valid even if this fails.
 */
export async function processBriefingIntelligenceReport(params: {
  reportId: string
  actorUid: string
  actorRole: 'admin' | 'system'
  force?: boolean
  jobId?: string
}): Promise<ProcessReportResult> {
  const { reportId, actorUid, actorRole, force = false } = params
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

  const jobId = params.jobId || transcriptionJobIdForReport(reportId)
  const existingJob = await getTranscriptionJob(db, jobId)
  let claimed = null as Awaited<ReturnType<typeof claimTranscriptionJob>>

  if (existingJob) {
    if (!force && existingJob.status === 'completed' && existingJob.transcriptId) {
      return {
        ok: true,
        reportId,
        skipped: true,
        transcriptId: existingJob.transcriptId,
      }
    }
    if (!force && existingJob.status === 'processing') {
      return { ok: true, reportId, skipped: true }
    }
    claimed = await claimTranscriptionJob(db, jobId)
    if (!claimed && !force) {
      return { ok: true, reportId, skipped: true }
    }
  }

  // If no job doc yet (admin force process), proceed without claim.
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
    },
  })

  try {
    if (!report.audioFileRef) {
      throw Object.assign(new Error('Missing audioFileRef on report'), { code: 'missing_audio' })
    }

    const bucket = admin.storage().bucket()
    const file = bucket.file(report.audioFileRef)
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
        metadata: {
          uploadedBy: 'system',
          reportId,
          requestId: report.requestId,
        },
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
      sourceAudioPath: report.audioFileRef,
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

    const transcriptionMeta = {
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
    }

    // Prefer async meeting-minutes report generation when flagged (separate from Whisper).
    if (isBriefingAiReportGenerationEnabled()) {
      const { assessTranscriptQuality } = await import('@/lib/briefing-intelligence/transcriptQuality')
      const {
        briefingRunIdFromReportId,
        logBriefingPipeline,
      } = await import('@/lib/briefing-intelligence/pipelineTrace')
      const briefingRunId = briefingRunIdFromReportId(reportId)

      const quality = assessTranscriptQuality({
        fullText: transcription.transcriptText,
        durationSeconds: transcription.durationSeconds ?? null,
        audioFileSizeMb: report.audioFileSizeMb,
        segmentCount: segments.length,
      })

      logBriefingPipeline({
        briefingRunId,
        reportId,
        requestId: report.requestId,
        tenderId: report.tenderId,
        jobId,
        stage: 'transcription_complete',
        status: quality.ok ? 'ok' : 'error',
        provider: transcription.provider,
        errorCategory: quality.ok ? null : quality.category,
        detail: quality.ok ? null : quality.reason,
      })

      if (!quality.ok) {
        const nowFail = nowIso()
        await docRef.set(
          {
            briefingRunId,
            transcription: transcriptionMeta,
            status: 'processing',
            updatedAt: nowFail,
            reportGenerationStatus: 'failed_quality_gate',
            lastError: quality.founderMessage.slice(0, 2000),
            pipelineDiagnostics: {
              briefingRunId,
              currentStage: 'failed_quality_gate',
              lastSuccessfulStage: 'transcription_complete',
              failureStage: 'failed_quality_gate',
              retryEligible: true,
              lastErrorCategory: quality.category,
              attemptCount: nextAttempts,
              evidenceIntact: Boolean(report.audioFileRef),
              transcriptIntact: true,
              draftAvailable: false,
              currentVersion: null,
              approvedVersion: null,
              qualityWarnings: [quality.founderMessage],
              updatedAt: nowFail,
            },
          },
          { merge: true }
        )
        // Transcript + evidence retained; do not auto-generate a polished draft.
        return { ok: true, reportId, transcriptId: transcriptRecord.id }
      }

      const { createOrResetReportJob } = await import('@/lib/briefing-intelligence/reportJobs')
      const { enqueueReportGenerationWorker } = await import(
        '@/lib/briefing-intelligence/enqueueReportGeneration'
      )
      const reportJob = await createOrResetReportJob({
        db,
        reportId,
        requestId: report.requestId,
        tenderId: report.tenderId,
        agentId: report.agentId,
        smeId: report.smeId,
        transcriptId: transcriptRecord.id,
      })

      const now2 = nowIso()
      await docRef.set(
        {
          briefingRunId,
          transcription: transcriptionMeta,
          status: 'processing',
          updatedAt: now2,
          lastError: null,
          reportGenerationStatus: 'waiting_for_transcript',
          pipelineDiagnostics: {
            briefingRunId,
            currentStage: 'report_generating',
            lastSuccessfulStage: 'transcription_complete',
            failureStage: null,
            retryEligible: true,
            lastErrorCategory: null,
            attemptCount: nextAttempts,
            evidenceIntact: Boolean(report.audioFileRef),
            transcriptIntact: true,
            draftAvailable: false,
            currentVersion: null,
            approvedVersion: null,
            qualityWarnings: quality.warnings,
            updatedAt: now2,
          },
        },
        { merge: true }
      )

      await enqueueReportGenerationWorker({
        jobId: reportJob.id,
        reportId,
        requestId: report.requestId,
        tenderId: report.tenderId,
      })

      try {
        const lifeNotify = require('../../backend/services/briefingLifecycleNotificationService')
        await lifeNotify.notifyTranscriptionCompletedSafe({
          reportId,
          requestId: report.requestId,
        })
      } catch {
        /* fail-soft */
      }

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
          phase: 'report_generation_enqueued',
          transcriptId: transcriptRecord.id,
          reportJobId: reportJob.id,
          briefingRunId,
        },
      })

      return { ok: true, reportId, transcriptId: transcriptRecord.id }
    }

    // Legacy path: synchronous extract → draft_report (when AI report flag is off).
    const tenderContext = await fetchAttendanceAndTenderContext({
      db,
      requestId: report.requestId,
      tenderId: report.tenderId,
      reportId,
    })

    const extracted = await provider.extractIntelligence(transcription.transcriptText, tenderContext)

    const now2 = nowIso()
    const reportContent: BriefingReportContent = {
      ...extracted,
      coverHeader: {
        ...extracted.coverHeader,
        reportId,
        reportDate: extracted.coverHeader.reportDate || now2,
      },
      sourceAndVerification: {
        ...extracted.sourceAndVerification,
        transcriptionProvider:
          extracted.sourceAndVerification.transcriptionProvider || transcription.provider,
        aiModel: extracted.sourceAndVerification.aiModel || transcription.model,
        processingDate: extracted.sourceAndVerification.processingDate || now2,
      },
    }

    const hasAttendanceEvidence =
      Array.isArray(report.attendanceEvidenceRefs) && report.attendanceEvidenceRefs.length > 0
    if (!hasAttendanceEvidence && reportContent?.attendanceVerification) {
      reportContent.attendanceVerification = {
        ...reportContent.attendanceVerification,
        verified: false,
        method: 'attendance_proof_missing',
        notes: null,
        redactedAttendeeCount: null,
      }
    }

    reportContent.importantNotice =
      'Standard disclaimer: This is a system-generated intelligence report draft. Always verify facts against the official tender documents.'
    reportContent.reportCertification = {
      certifiedBy: 'TenderBriefing Intelligence System',
      certificationDate: now2,
      reportVersion: '1.0',
    }

    await docRef.set(
      {
        transcription: transcriptionMeta,
        reportContent,
        status: 'draft_report',
        draftReadyAt: now2,
        updatedAt: now2,
        lastError: null,
      },
      { merge: true }
    )

    await syncSlaForReport({ db, reportId, now: new Date(now2) })

    await logBriefingIntelligenceAuditEvent({
      db,
      eventType: 'draft_ready',
      reportId,
      requestId: report.requestId,
      agentId: report.agentId,
      smeId: report.smeId,
      actorUid,
      actorRole,
      nextStatus: 'draft_report',
      meta: {
        transcriptWordCount: transcription.transcriptWordCount ?? null,
        transcriptId: transcriptRecord.id,
        segmentCount: segments.length,
      },
    })

    return { ok: true, reportId, transcriptId: transcriptRecord.id }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const code =
      error && typeof error === 'object' && 'code' in error
        ? String((error as { code?: string }).code || 'transcription_failed')
        : 'transcription_failed'
    const retryable = !['missing_audio'].includes(code)

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
        // Keep evidence; clear only AI artifacts so we never deliver stale content.
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
