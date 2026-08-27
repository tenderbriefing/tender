import { getFirebaseAdmin } from '@/lib/backend/firebaseAdmin'
import type { BriefingIntelligenceReport } from '@/lib/briefing-intelligence/types'
import { getBriefingTranscript } from '@/lib/briefing-intelligence/transcriptStore'
import { loadTenderDocumentText } from '@/lib/briefing-intelligence/tenderDocumentText'
import { getBriefingSummaryService } from '@/lib/briefing-intelligence/briefingSummaryService'
import {
  claimReportJob,
  completeReportJob,
  failReportJob,
  getReportJob,
} from '@/lib/briefing-intelligence/reportJobs'
import {
  nextReportVersionNumber,
  saveReportVersion,
} from '@/lib/briefing-intelligence/reportVersions'
import {
  loadDefaultLogoBytes,
  renderMeetingMinutesPdf,
  sanitizeReportFileName,
} from '@/lib/briefing-intelligence/meetingMinutesPdf'
import { meetingMinutesToBriefingReportContent } from '@/lib/briefing-intelligence/mapMeetingMinutesToReportContent'
import { logBriefingIntelligenceAuditEvent } from '@/lib/briefing-intelligence/auditService'
import { syncSlaForReport } from '@/lib/briefing-intelligence/slaService'
import { isBriefingAiReportGenerationEnabled } from '@/lib/briefing-intelligence/featureFlag'
import { fetchAttendanceAndTenderContext } from '@/lib/briefing-intelligence/tenderContext'
import {
  applyAuthoritativeTenderFields,
  runMeetingMinutesQualityGate,
} from '@/lib/briefing-intelligence/reportQualityGate'
import { assessTranscriptQuality } from '@/lib/briefing-intelligence/transcriptQuality'
import {
  briefingRunIdFromReportId,
  classifyErrorMessage,
  logBriefingPipeline,
} from '@/lib/briefing-intelligence/pipelineTrace'

function nowIso() {
  return new Date().toISOString()
}

export type GenerateMeetingMinutesResult =
  | { ok: true; reportId: string; versionId: string; pdfStoragePath: string | null; skipped?: boolean }
  | { ok: false; reportId: string; error: string; retryable: boolean }

/**
 * Generate meeting-minutes draft + PDF from durable transcript.
 * Does not delete transcript or evidence on failure.
 */
export async function generateMeetingMinutesReport(params: {
  reportId: string
  jobId: string
  actorUid: string
  actorRole: 'admin' | 'system'
  force?: boolean
}): Promise<GenerateMeetingMinutesResult> {
  const { reportId, jobId, actorUid, actorRole } = params

  if (!isBriefingAiReportGenerationEnabled() && !params.force) {
    return { ok: false, reportId, error: 'AI report generation disabled', retryable: false }
  }

  const admin = getFirebaseAdmin()
  const db = admin.firestore()
  const docRef = db.collection('briefingIntelligenceReports').doc(reportId)
  const snap = await docRef.get()
  if (!snap.exists) {
    return { ok: false, reportId, error: 'Report not found', retryable: false }
  }
  const report = snap.data() as BriefingIntelligenceReport
  const briefingRunId = briefingRunIdFromReportId(reportId)
  const startedAt = Date.now()

  const existingJob = await getReportJob(db, jobId)
  if (existingJob?.status === 'completed' && !params.force) {
    logBriefingPipeline({
      briefingRunId,
      reportId,
      requestId: report.requestId,
      tenderId: report.tenderId,
      jobId,
      stage: 'draft_ready',
      status: 'skipped',
      detail: 'report_job_already_completed',
    })
    return {
      ok: true,
      reportId,
      versionId: existingJob.reportVersionId || '',
      pdfStoragePath: existingJob.pdfStoragePath,
      skipped: true,
    }
  }

  const claimed = await claimReportJob(db, jobId)
  if (!claimed && !params.force) {
    return { ok: true, reportId, versionId: '', pdfStoragePath: null, skipped: true }
  }

  const now = nowIso()
  await docRef.set(
    {
      briefingRunId,
      reportGenerationStatus: 'generating',
      updatedAt: now,
      lastError: null,
      pipelineDiagnostics: {
        briefingRunId,
        currentStage: 'report_generating',
        lastSuccessfulStage: 'transcription_complete',
        failureStage: null,
        retryEligible: true,
        lastErrorCategory: null,
        attemptCount: claimed?.attempts || existingJob?.attempts || 1,
        evidenceIntact: Boolean(report.audioFileRef),
        transcriptIntact: Boolean(report.transcription?.transcriptId),
        draftAvailable: false,
        currentVersion: null,
        approvedVersion: null,
        qualityWarnings: [],
        updatedAt: now,
      },
    },
    { merge: true }
  )

  try {
    const transcriptId =
      claimed?.transcriptId ||
      existingJob?.transcriptId ||
      report.transcription?.transcriptId ||
      ''
    if (!transcriptId) {
      throw Object.assign(new Error('Missing transcriptId for report generation'), {
        code: 'missing_transcript',
      })
    }

    const transcript = await getBriefingTranscript(db, transcriptId)
    if (!transcript?.fullText) {
      throw Object.assign(new Error('Transcript not found or empty'), {
        code: 'missing_transcript',
      })
    }

    const tq = assessTranscriptQuality({
      fullText: transcript.fullText,
      durationSeconds: transcript.durationSeconds ?? report.transcription?.durationSeconds ?? null,
      audioFileSizeMb: report.audioFileSizeMb,
      segmentCount: transcript.segments?.length ?? null,
    })
    if (!tq.ok) {
      throw Object.assign(new Error(tq.founderMessage), {
        code: tq.category,
        qualityGate: true,
      })
    }

    const tenderCtx = await fetchAttendanceAndTenderContext({
      db,
      requestId: report.requestId,
      tenderId: report.tenderId,
      reportId,
    })
    const tenderDoc = await loadTenderDocumentText({ db, tenderId: report.tenderId })
    const documentComparisonStatus: 'full' | 'metadata_only' | 'unavailable' =
      tenderDoc.sourceUrls.length > 0
        ? 'full'
        : tenderDoc.text.trim().length > 40
          ? 'metadata_only'
          : 'unavailable'

    const tenderSnap = await db.collection('tenderBriefings').doc(report.tenderId).get()
    const tender = tenderSnap.data() as any
    const requiresCert = Boolean(
      tender?.briefingCertificateRequired ||
        /certificate|information session/i.test(String(tenderDoc.text || ''))
    )

    const officialMetadata = {
      tenderTitle: tenderCtx.tenderTitle,
      tenderNumber: tenderCtx.tenderReference,
      department: tenderCtx.issuingEntity,
      briefingDate: tenderCtx.briefingDate,
      briefingVenue: tenderCtx.briefingVenue,
      closingDate: tenderCtx.closingDate,
      closingTime: tender?.closingTime ? String(tender.closingTime) : null,
      requiresBriefingCertificate: requiresCert,
    }

    logBriefingPipeline({
      briefingRunId,
      reportId,
      requestId: report.requestId,
      tenderId: report.tenderId,
      jobId,
      stage: 'report_generating',
      status: 'ok',
      provider: 'openai',
      attempt: claimed?.attempts || existingJob?.attempts || 1,
      detail: `documentComparisonStatus=${documentComparisonStatus}`,
    })

    console.info('[briefing-report] summary started', {
      briefingRunId,
      requestId: report.requestId,
      reportId,
      tenderId: report.tenderId,
      transcriptId,
      documentComparisonStatus,
    })

    const summaryService = getBriefingSummaryService()
    const result = await summaryService.summarize({
      reportId,
      transcriptText: transcript.fullText,
      transcriptSegments: (transcript.segments || []).map((s) => ({
        id: s.id,
        startSeconds: s.startSeconds,
        endSeconds: s.endSeconds,
        text: s.text,
      })),
      tenderDocumentText: tenderDoc.text,
      documentComparisonStatus,
      officialMetadata,
    })

    let structured = applyAuthoritativeTenderFields(result.structuredReport, {
      tenderTitle: officialMetadata.tenderTitle,
      tenderNumber: officialMetadata.tenderNumber,
      department: officialMetadata.department,
      briefingDate: officialMetadata.briefingDate,
      briefingVenue: officialMetadata.briefingVenue,
      closingDate: officialMetadata.closingDate,
    })
    result.structuredReport = structured

    const gate = runMeetingMinutesQualityGate({
      report: structured,
      official: {
        tenderTitle: officialMetadata.tenderTitle,
        tenderNumber: officialMetadata.tenderNumber,
        department: officialMetadata.department,
        briefingDate: officialMetadata.briefingDate,
        briefingVenue: officialMetadata.briefingVenue,
        closingDate: officialMetadata.closingDate,
      },
      transcriptText: transcript.fullText,
    })
    if (!gate.ok) {
      throw Object.assign(new Error(gate.founderMessage), {
        code: gate.category,
        qualityGate: true,
        qualityWarnings: gate.warnings,
      })
    }
    structured = applyAuthoritativeTenderFields(structured, {
      tenderTitle: officialMetadata.tenderTitle,
      tenderNumber: officialMetadata.tenderNumber,
      department: officialMetadata.department,
      briefingDate: officialMetadata.briefingDate,
      briefingVenue: officialMetadata.briefingVenue,
      closingDate: officialMetadata.closingDate,
    })
    result.structuredReport = structured

    // Load attendance image (first image-like proof)
    let attendanceBytes: Uint8Array | null = null
    let attendanceMime: string | null = null
    const bucket = admin.storage().bucket()
    const attendanceRef = (report.attendanceEvidenceRefs || [])[0]
    if (attendanceRef) {
      try {
        const [buf] = await bucket.file(attendanceRef).download()
        attendanceBytes = buf
        const lower = attendanceRef.toLowerCase()
        attendanceMime = lower.endsWith('.png')
          ? 'image/png'
          : lower.endsWith('.jpg') || lower.endsWith('.jpeg')
            ? 'image/jpeg'
            : lower.endsWith('.webp')
              ? 'image/webp'
              : 'image/jpeg'
      } catch {
        attendanceBytes = null
      }
    }

    const logoBytes = await loadDefaultLogoBytes()
    const pdfBuffer = await renderMeetingMinutesPdf({
      report: result.structuredReport,
      logoBytes,
      attendanceImageBytes: attendanceBytes,
      attendanceMime,
      reportId,
    })

    const fileName = sanitizeReportFileName({
      tenderNumber: result.structuredReport.cover.tenderNumber,
      reportId,
    })
    const pdfPath = `briefing-intelligence/${reportId}/pdf/${fileName}`
    await bucket.file(pdfPath).save(pdfBuffer, {
      contentType: 'application/pdf',
      metadata: {
        uploadedBy: 'system',
        reportId,
        requestId: report.requestId,
        promptVersion: result.promptVersion,
        briefingRunId,
      },
      resumable: false,
    })

    const version = await nextReportVersionNumber(db, reportId)
    const versionRecord = await saveReportVersion({
      db,
      reportId,
      requestId: report.requestId,
      tenderId: report.tenderId,
      version,
      structuredContent: result.structuredReport,
      summary: result.summary,
      pdfStoragePath: pdfPath,
      promptVersion: result.promptVersion,
      model: result.model,
      transcriptId,
    })

    const hasAttendanceEvidence =
      Array.isArray(report.attendanceEvidenceRefs) && report.attendanceEvidenceRefs.length > 0
    const reportContent = meetingMinutesToBriefingReportContent(
      result.structuredReport,
      reportId,
      { hasAttendanceEvidence }
    )
    reportContent.sourceAndVerification = {
      ...reportContent.sourceAndVerification,
      transcriptionProvider: report.transcription?.provider || null,
      aiModel: result.model,
      processingDate: nowIso(),
    }

    const readyAt = nowIso()
    const qualityWarnings = [...(tq.warnings || []), ...(gate.warnings || [])]
    try {
      const { assessBriefingIntelligenceV2Quality } = await import(
        '@/lib/briefing-intelligence/briefingIntelligenceV2'
      )
      const v2q = assessBriefingIntelligenceV2Quality(
        (result.structuredReport as { briefingIntelligenceV2?: any })?.briefingIntelligenceV2
      )
      qualityWarnings.push(...v2q.warnings)
    } catch {
      /* optional */
    }
    await docRef.set(
      {
        briefingRunId,
        status: 'draft_report',
        draftReadyAt: readyAt,
        updatedAt: readyAt,
        reportContent,
        meetingMinutes: result.structuredReport,
        meetingMinutesSummary: result.summary,
        meetingMinutesVersionId: versionRecord.id,
        meetingMinutesPromptVersion: result.promptVersion,
        pdfStorageRef: pdfPath,
        reportGenerationStatus: 'draft_ready',
        lastError: null,
        pipelineDiagnostics: {
          briefingRunId,
          currentStage: 'draft_ready',
          lastSuccessfulStage: 'draft_ready',
          failureStage: null,
          retryEligible: true,
          lastErrorCategory: null,
          attemptCount: claimed?.attempts || existingJob?.attempts || 1,
          evidenceIntact: Boolean(report.audioFileRef),
          transcriptIntact: true,
          draftAvailable: true,
          currentVersion: versionRecord.version,
          approvedVersion: null,
          qualityWarnings,
          updatedAt: readyAt,
        },
      },
      { merge: true }
    )

    await completeReportJob({
      db,
      jobId,
      reportVersionId: versionRecord.id,
      pdfStoragePath: pdfPath,
      aiModel: result.model,
    })

    await syncSlaForReport({ db, reportId, now: new Date(readyAt) })
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
        reportVersionId: versionRecord.id,
        promptVersion: result.promptVersion,
        model: result.model,
        pdfStoragePath: pdfPath,
        briefingRunId,
      },
    })

    try {
      const lifeNotify = require('../../backend/services/briefingLifecycleNotificationService')
      await lifeNotify.notifyDraftReadySafe({
        reportId,
        requestId: report.requestId,
        tenderTitle: (report as { tenderTitle?: string }).tenderTitle,
        version: versionRecord.version,
        detail: qualityWarnings.length
          ? `Draft ready with ${qualityWarnings.length} quality warning(s) for Founder review.`
          : `Version ${versionRecord.version} awaiting Founder approval.`,
      })
    } catch {
      /* fail-soft */
    }

    logBriefingPipeline({
      briefingRunId,
      reportId,
      requestId: report.requestId,
      tenderId: report.tenderId,
      jobId,
      stage: 'draft_ready',
      status: 'ok',
      provider: result.provider,
      durationMs: Date.now() - startedAt,
      detail: `version=${versionRecord.version}`,
    })

    console.info('[briefing-report] draft stored', {
      briefingRunId,
      requestId: report.requestId,
      reportId,
      tenderId: report.tenderId,
      versionId: versionRecord.id,
    })

    return {
      ok: true,
      reportId,
      versionId: versionRecord.id,
      pdfStoragePath: pdfPath,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const code =
      error && typeof error === 'object' && 'code' in error
        ? String((error as { code?: string }).code || 'report_generation_failed')
        : 'report_generation_failed'
    const qualityGate =
      error && typeof error === 'object' && 'qualityGate' in error
        ? Boolean((error as { qualityGate?: boolean }).qualityGate)
        : code.includes('quality') ||
          code === 'empty_transcript' ||
          code === 'low_quality_transcript' ||
          code === 'hallucination_guard'
    const category = classifyErrorMessage(`${code} ${message}`)
    const retryable =
      ![
        'missing_transcript',
        'empty_transcript',
        'low_quality_transcript',
        'hallucination_guard',
        'quality_gate',
        'ai_schema',
        'ai_invalid_json',
      ].includes(code) && !qualityGate

    await failReportJob({
      db,
      jobId,
      errorCode: code,
      errorMessage: message,
      retry: retryable,
    })

    const failNow = nowIso()
    await docRef.set(
      {
        briefingRunId,
        reportGenerationStatus: qualityGate ? 'failed_quality_gate' : 'failed',
        lastError: message.slice(0, 2000),
        updatedAt: failNow,
        pipelineDiagnostics: {
          briefingRunId,
          currentStage: qualityGate ? 'failed_quality_gate' : 'failed',
          lastSuccessfulStage: 'transcription_complete',
          failureStage: qualityGate ? 'failed_quality_gate' : 'failed',
          retryEligible: retryable,
          lastErrorCategory: category,
          attemptCount: claimed?.attempts || existingJob?.attempts || 1,
          evidenceIntact: Boolean(report.audioFileRef),
          transcriptIntact: Boolean(report.transcription?.transcriptId),
          draftAvailable: false,
          currentVersion: null,
          approvedVersion: null,
          qualityWarnings: [message.slice(0, 500)],
          updatedAt: failNow,
        },
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
      meta: { phase: 'report_generation', jobId, briefingRunId, errorCategory: category },
    })

    try {
      const lifeNotify = require('../../backend/services/briefingLifecycleNotificationService')
      await lifeNotify.notifyAiFailureSafe({
        reportId,
        requestId: report.requestId,
        attempt: claimed?.attempts || existingJob?.attempts || 1,
        detail: `${category || 'error'}: ${String(message).slice(0, 180)}`,
        smeSafeDetail:
          'Briefing report generation needs operational retry. Evidence and Youth Agent eligibility are preserved.',
      })
    } catch {
      /* fail-soft */
    }

    logBriefingPipeline({
      briefingRunId,
      reportId,
      requestId: report.requestId,
      tenderId: report.tenderId,
      jobId,
      stage: qualityGate ? 'failed_quality_gate' : 'failed',
      status: 'error',
      errorCategory: category,
      durationMs: Date.now() - startedAt,
      detail: code,
    })

    return { ok: false, reportId, error: message, retryable }
  }
}
