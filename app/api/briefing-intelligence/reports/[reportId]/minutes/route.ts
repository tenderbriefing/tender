import { NextRequest, NextResponse } from 'next/server'
import { verifyApiUser, unauthorizedResponse } from '@/lib/auth/verifyApiUser'
import { getFirebaseAdmin } from '@/lib/backend/firebaseAdmin'
import type { BriefingIntelligenceReport } from '@/lib/briefing-intelligence/types'
import { getLatestReportVersion, approveReportVersion } from '@/lib/briefing-intelligence/reportVersions'
import { getReportJobForReport, createOrResetReportJob } from '@/lib/briefing-intelligence/reportJobs'
import { getTranscriptionJobForReport } from '@/lib/briefing-intelligence/transcriptionJobs'
import { enqueueReportGenerationWorker } from '@/lib/briefing-intelligence/enqueueReportGeneration'
import { isBriefingAiReportGenerationEnabled } from '@/lib/briefing-intelligence/featureFlag'
import { logBriefingIntelligenceAuditEvent } from '@/lib/briefing-intelligence/auditService'

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ reportId: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['admin'])
  if (!user) return unauthorizedResponse('Admin sign-in required')

  const { reportId } = await context.params
  const admin = getFirebaseAdmin()
  const db = admin.firestore()
  const snap = await db.collection('briefingIntelligenceReports').doc(reportId).get()
  if (!snap.exists) {
    return NextResponse.json({ success: false, error: 'Report not found' }, { status: 404 })
  }
  const report = snap.data() as BriefingIntelligenceReport
  const [version, reportJob, transcriptionJob] = await Promise.all([
    getLatestReportVersion(db, reportId),
    getReportJobForReport(db, reportId),
    getTranscriptionJobForReport(db, reportId),
  ])

  let pdfSignedUrl: string | null = null
  const pdfPath = version?.pdfStoragePath || report.pdfStorageRef
  if (pdfPath) {
    try {
      const [url] = await admin
        .storage()
        .bucket()
        .file(pdfPath)
        .getSignedUrl({ action: 'read', expires: Date.now() + 15 * 60 * 1000 })
      pdfSignedUrl = url
    } catch {
      pdfSignedUrl = null
    }
  }

  let attendanceSignedUrls: string[] = []
  for (const ref of (report.attendanceEvidenceRefs || []).slice(0, 3)) {
    try {
      const [url] = await admin
        .storage()
        .bucket()
        .file(ref)
        .getSignedUrl({ action: 'read', expires: Date.now() + 15 * 60 * 1000 })
      attendanceSignedUrls.push(url)
    } catch {
      /* skip */
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      reportId,
      requestId: report.requestId,
      tenderId: report.tenderId,
      agentId: report.agentId,
      reportStatus: report.status,
      reportGenerationStatus: (report as any).reportGenerationStatus || null,
      transcriptionJob: transcriptionJob
        ? { id: transcriptionJob.id, status: transcriptionJob.status, completedAt: transcriptionJob.completedAt }
        : null,
      reportJob: reportJob
        ? {
            id: reportJob.id,
            status: reportJob.status,
            attempts: reportJob.attempts,
            maxAttempts: reportJob.maxAttempts,
            errorMessage: reportJob.errorMessage,
            promptVersion: reportJob.promptVersion,
            completedAt: reportJob.completedAt,
          }
        : null,
      version: version
        ? {
            id: version.id,
            version: version.version,
            status: version.status,
            promptVersion: version.promptVersion,
            model: version.model,
            createdAt: version.createdAt,
            approvedAt: version.approvedAt,
            structuredContent: version.structuredContent,
            pdfStoragePath: version.pdfStoragePath,
          }
        : null,
      meetingMinutes: (report as any).meetingMinutes || version?.structuredContent || null,
      pdfSignedUrl,
      attendanceSignedUrls,
      transcriptId: report.transcription?.transcriptId || null,
    },
  })
}

/** Approve current draft OR regenerate (body.action). */
export async function POST(request: NextRequest, context: RouteContext) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['admin'])
  if (!user) return unauthorizedResponse('Admin sign-in required')

  const { reportId } = await context.params
  let body: { action?: string } = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }
  const action = String(body.action || 'approve')

  const admin = getFirebaseAdmin()
  const db = admin.firestore()
  const snap = await db.collection('briefingIntelligenceReports').doc(reportId).get()
  if (!snap.exists) {
    return NextResponse.json({ success: false, error: 'Report not found' }, { status: 404 })
  }
  const report = snap.data() as BriefingIntelligenceReport

  if (action === 'regenerate') {
    if (!isBriefingAiReportGenerationEnabled()) {
      return NextResponse.json(
        { success: false, error: 'AI report generation is disabled' },
        { status: 503 }
      )
    }
    const transcriptId = report.transcription?.transcriptId
    if (!transcriptId) {
      return NextResponse.json({ success: false, error: 'No transcript to regenerate from' }, { status: 400 })
    }
    const job = await createOrResetReportJob({
      db,
      reportId,
      requestId: report.requestId,
      tenderId: report.tenderId,
      agentId: report.agentId,
      smeId: report.smeId,
      transcriptId,
      force: true,
    })
    await enqueueReportGenerationWorker({
      jobId: job.id,
      reportId,
      requestId: report.requestId,
      tenderId: report.tenderId,
    })
    return NextResponse.json({ success: true, data: { reportId, jobId: job.id, enqueued: true } })
  }

  // approve
  const version = await getLatestReportVersion(db, reportId)
  if (!version) {
    return NextResponse.json({ success: false, error: 'No report version to approve' }, { status: 404 })
  }
  const approved = await approveReportVersion({
    db,
    versionId: version.id,
    approvedBy: user.uid,
  })
  const now = new Date().toISOString()
  await db.collection('briefingIntelligenceReports').doc(reportId).set(
    {
      status: 'final',
      finalizedAt: now,
      updatedAt: now,
      reportGenerationStatus: 'approved',
      agentReviewedAt: now,
    },
    { merge: true }
  )
  await logBriefingIntelligenceAuditEvent({
    db,
    eventType: 'reviewed',
    reportId,
    requestId: report.requestId,
    agentId: report.agentId,
    smeId: report.smeId,
    actorUid: user.uid,
    actorRole: 'admin',
    nextStatus: 'final',
    meta: { versionId: version.id },
  })

  return NextResponse.json({ success: true, data: { reportId, version: approved } })
}
