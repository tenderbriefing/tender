import { NextRequest, NextResponse } from 'next/server'
import { verifyApiUser, unauthorizedResponse } from '@/lib/auth/verifyApiUser'
import { getFirebaseAdmin } from '@/lib/backend/firebaseAdmin'
import type { BriefingIntelligenceReport } from '@/lib/briefing-intelligence/types'
import { getBriefingTranscriptForReport } from '@/lib/briefing-intelligence/transcriptStore'
import { getTranscriptionJobForReport } from '@/lib/briefing-intelligence/transcriptionJobs'
import { enqueueTranscriptionWorker } from '@/lib/briefing-intelligence/enqueueTranscription'
import {
  createOrResetTranscriptionJob,
} from '@/lib/briefing-intelligence/transcriptionJobs'
import { isBriefingAudioTranscriptionEnabled } from '@/lib/briefing-intelligence/featureFlag'

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ reportId: string }> }

/**
 * Admin/founder: fetch durable transcript + job status.
 * Youth agents and SMEs are denied (raw transcript is operational, not client-facing yet).
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['admin'])
  if (!user) return unauthorizedResponse('Admin sign-in required')

  const { reportId } = await context.params
  if (!reportId) {
    return NextResponse.json({ success: false, error: 'reportId required' }, { status: 400 })
  }

  const admin = getFirebaseAdmin()
  const db = admin.firestore()
  const snap = await db.collection('briefingIntelligenceReports').doc(reportId).get()
  if (!snap.exists) {
    return NextResponse.json({ success: false, error: 'Report not found' }, { status: 404 })
  }

  const report = snap.data() as BriefingIntelligenceReport
  const [transcript, job] = await Promise.all([
    getBriefingTranscriptForReport(db, reportId),
    getTranscriptionJobForReport(db, reportId),
  ])

  let audioSignedUrl: string | null = null
  if (report.audioFileRef) {
    try {
      const [url] = await admin
        .storage()
        .bucket()
        .file(report.audioFileRef)
        .getSignedUrl({ action: 'read', expires: Date.now() + 15 * 60 * 1000 })
      audioSignedUrl = url
    } catch {
      audioSignedUrl = null
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      reportId,
      requestId: report.requestId,
      tenderId: report.tenderId,
      reportStatus: report.status,
      audioFileRef: report.audioFileRef,
      audioSignedUrl,
      attendanceEvidenceCount: report.attendanceEvidenceRefs?.length || 0,
      job: job
        ? {
            id: job.id,
            status: job.status,
            attempts: job.attempts,
            maxAttempts: job.maxAttempts,
            errorCode: job.errorCode,
            errorMessage: job.errorMessage,
            completedAt: job.completedAt,
            updatedAt: job.updatedAt,
            provider: job.provider,
            detectedLanguage: job.detectedLanguage,
            audioDurationSeconds: job.audioDurationSeconds,
          }
        : null,
      transcript: transcript
        ? {
            id: transcript.id,
            fullText: transcript.fullText,
            segments: transcript.segments,
            language: transcript.language,
            durationSeconds: transcript.durationSeconds,
            provider: transcript.provider,
            model: transcript.model,
            status: transcript.status,
            createdAt: transcript.createdAt,
            updatedAt: transcript.updatedAt,
          }
        : null,
    },
  })
}

/** Admin: controlled retry of transcription without exposing to Youth Agents. */
export async function POST(request: NextRequest, context: RouteContext) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['admin'])
  if (!user) return unauthorizedResponse('Admin sign-in required')

  if (!isBriefingAudioTranscriptionEnabled()) {
    return NextResponse.json(
      { success: false, error: 'Briefing audio transcription is disabled' },
      { status: 503 }
    )
  }

  const { reportId } = await context.params
  const admin = getFirebaseAdmin()
  const db = admin.firestore()
  const snap = await db.collection('briefingIntelligenceReports').doc(reportId).get()
  if (!snap.exists) {
    return NextResponse.json({ success: false, error: 'Report not found' }, { status: 404 })
  }
  const report = snap.data() as BriefingIntelligenceReport
  if (!report.audioFileRef) {
    return NextResponse.json({ success: false, error: 'No audio on report' }, { status: 400 })
  }

  const job = await createOrResetTranscriptionJob({
    db,
    reportId,
    requestId: report.requestId,
    tenderId: report.tenderId,
    agentId: report.agentId,
    smeId: report.smeId,
    audioStoragePath: report.audioFileRef,
    audioMimeType: null,
    audioSizeBytes: report.audioFileSizeMb
      ? Math.round(report.audioFileSizeMb * 1024 * 1024)
      : null,
    provider: process.env.BRIEFING_INTELLIGENCE_PROVIDER || 'speechmatics',
  })

  // Force reset to queued if previously completed/failed for retry.
  await db
    .collection('briefingTranscriptionJobs')
    .doc(job.id)
    .set(
      {
        status: 'queued',
        attempts: 0,
        errorCode: null,
        errorMessage: null,
        transcriptId: null,
        completedAt: null,
        updatedAt: new Date().toISOString(),
        nextAttemptAt: new Date().toISOString(),
      },
      { merge: true }
    )

  await enqueueTranscriptionWorker({
    jobId: job.id,
    reportId,
    requestId: report.requestId,
    tenderId: report.tenderId,
  })

  return NextResponse.json({ success: true, data: { reportId, jobId: job.id, enqueued: true } })
}
