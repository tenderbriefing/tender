import type { Firestore, DocumentReference } from 'firebase-admin/firestore'
import type { BriefingIntelligenceReport, BriefingReportContent } from './types'
import type { BriefingTranscriptRecord, TranscriptSegment } from './transcriptionTypes'
import { isBriefingAiReportGenerationEnabled } from './featureFlag'
import { logBriefingIntelligenceAuditEvent } from './auditService'
import { syncSlaForReport } from './slaService'
import { fetchAttendanceAndTenderContext } from './tenderContext'
import { getTranscriptionProvider } from './transcriptionService'

function nowIso() {
  return new Date().toISOString()
}

function computeWordCount(text: string): number | null {
  const t = String(text || '').trim()
  if (!t) return null
  return t.split(/\s+/).filter(Boolean).length
}

export type TranscriptionMeta = {
  provider: string
  rawTranscriptRef: string
  transcriptWordCount: number | null
  language: string | null
  confidence: number | null
  completedAt: string
  transcriptId: string
  segmentCount: number
  durationSeconds: number | null
  transcriptionMode?: 'direct' | 'chunked'
  chunkCount?: number
}

/**
 * Shared post-transcript handoff: quality gate → report job OR legacy extract.
 * Used by both direct and chunked transcription paths.
 */
export async function handoffAfterTranscriptSaved(params: {
  db: Firestore
  docRef: DocumentReference
  report: BriefingIntelligenceReport
  reportId: string
  jobId: string
  actorUid: string
  actorRole: 'admin' | 'system'
  nextAttempts: number
  transcriptRecord: BriefingTranscriptRecord
  transcriptionMeta: TranscriptionMeta
  fullText: string
  segments: TranscriptSegment[]
  durationSeconds: number | null
  provider: string
  model: string | null
}): Promise<{ ok: true; transcriptId: string }> {
  const {
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
    fullText,
    segments,
    durationSeconds,
    provider,
    model,
  } = params

  if (isBriefingAiReportGenerationEnabled()) {
    const { assessTranscriptQuality } = await import('./transcriptQuality')
    const { briefingRunIdFromReportId, logBriefingPipeline } = await import('./pipelineTrace')
    const briefingRunId = briefingRunIdFromReportId(reportId)

    const quality = assessTranscriptQuality({
      fullText,
      durationSeconds,
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
      provider,
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
      return { ok: true, transcriptId: transcriptRecord.id }
    }

    const { createOrResetReportJob } = await import('./reportJobs')
    const { enqueueReportGenerationWorker } = await import('./enqueueReportGeneration')
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

    return { ok: true, transcriptId: transcriptRecord.id }
  }

  const tenderContext = await fetchAttendanceAndTenderContext({
    db,
    requestId: report.requestId,
    tenderId: report.tenderId,
    reportId,
  })

  const transcriptionProvider = getTranscriptionProvider()
  const extracted = await transcriptionProvider.extractIntelligence(fullText, tenderContext)

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
        extracted.sourceAndVerification.transcriptionProvider || provider,
      aiModel: extracted.sourceAndVerification.aiModel || model,
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
      transcriptWordCount: computeWordCount(fullText),
      transcriptId: transcriptRecord.id,
      segmentCount: segments.length,
    },
  })

  return { ok: true, transcriptId: transcriptRecord.id }
}
