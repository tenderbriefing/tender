import { NextRequest, NextResponse } from 'next/server'
import { verifyApiUser, unauthorizedResponse } from '@/lib/auth/verifyApiUser'
import { getFirebaseAdmin } from '@/lib/backend/firebaseAdmin'
import type { BriefingIntelligenceReport, BriefingReportContent } from '@/lib/briefing-intelligence/types'
import { getTranscriptionProvider, type TenderContext } from '@/lib/briefing-intelligence/transcriptionService'
import { logBriefingIntelligenceAuditEvent } from '@/lib/briefing-intelligence/auditService'
import { syncSlaForReport } from '@/lib/briefing-intelligence/slaService'
import type { Firestore } from 'firebase-admin/firestore'

export const dynamic = 'force-dynamic'

function toStringOrNull(v: unknown): string | null {
  if (v === undefined || v === null) return null
  const s = String(v).trim()
  return s ? s : null
}

function nowIso() {
  return new Date().toISOString()
}

function computeWordCount(text: string): number | null {
  const t = String(text || '').trim()
  if (!t) return null
  return t.split(/\s+/).filter(Boolean).length
}

async function fetchAttendanceAndTenderContext(params: {
  db: Firestore
  requestId: string
  tenderId: string
  reportId: string
}): Promise<TenderContext> {
  const { db, requestId, tenderId, reportId } = params

  const [reqSnap, tenderSnap] = await Promise.all([
    db.collection('attendanceRequests').doc(requestId).get(),
    db.collection('tenderBriefings').doc(tenderId).get(),
  ])

  const req = reqSnap.data() as any
  const tender = tenderSnap.data() as any

  return {
    reportId,
    tenderTitle: String(tender?.title || tender?.tenderTitle || req?.tenderTitle || ''),
    tenderReference: String(tender?.tenderNumber || tender?.tenderReference || req?.tenderNumber || req?.tenderReference || ''),
    issuingEntity: String(tender?.department || tender?.issuer || tender?.issuingEntity || req?.department || ''),
    briefingDate: String(tender?.briefingDate || req?.briefingDate || ''),
    briefingVenue: String(tender?.briefingVenue || req?.briefingVenue || ''),
    description: toStringOrNull(tender?.description || tender?.detail || tender?.summary || null),
    closingDate: toStringOrNull(tender?.closingDate || null),
    estimatedValue: toStringOrNull(tender?.estimatedValue || tender?.estimatedValueLabel || null),
    category: toStringOrNull(tender?.industrySector || tender?.category || null),
    province: toStringOrNull(tender?.province || req?.province || null),
  }
}

export async function POST(request: NextRequest) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['admin'])
  if (!user) return unauthorizedResponse('Admin sign-in required')

  let reportIdForFailure = ''
  try {
    const body = await request.json()
    const reportId = String(body?.reportId || '')
    reportIdForFailure = reportId
    const force = Boolean(body?.force)

    if (!reportId) {
      return NextResponse.json({ success: false, error: 'reportId is required' }, { status: 400 })
    }

    const admin = getFirebaseAdmin()
    const db = admin.firestore()

    const docRef = db.collection('briefingIntelligenceReports').doc(reportId)
    const snap = await docRef.get()
    if (!snap.exists) {
      return NextResponse.json({ success: false, error: 'Report not found' }, { status: 404 })
    }

    const report = snap.data() as BriefingIntelligenceReport

    if (report.status === 'delivered') {
      return NextResponse.json({ success: true, data: { reportId, skipped: true } })
    }
    if (!force && ['processing', 'draft_report', 'agent_review', 'final'].includes(report.status)) {
      return NextResponse.json({ success: true, data: { reportId, skipped: true } })
    }

    const now = nowIso()

    // Attempt counter + transition to processing.
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
      actorUid: user.uid,
      actorRole: 'admin',
      nextStatus: 'processing',
      meta: { processingAttempts: nextAttempts },
    })

    if (!report.audioFileRef) {
      throw new Error('Missing audioFileRef on report')
    }

    const bucket = admin.storage().bucket()
    const file = bucket.file(report.audioFileRef)
    const [audioUrl] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 60 * 60 * 1000,
    })

    const provider = getTranscriptionProvider()

    const transcription = await provider.transcribe(audioUrl)

    // Save raw transcript (not public).
    const transcriptPath = `briefing-intelligence/${reportId}/transcripts/raw-${Date.now()}.json`
    await bucket
      .file(transcriptPath)
      .save(Buffer.from(JSON.stringify({ ...transcription })), {
        contentType: 'application/json',
        metadata: {
          uploadedBy: 'system',
          reportId,
          requestId: report.requestId,
        },
        resumable: false,
      })

    const tenderContext = await fetchAttendanceAndTenderContext({
      db,
      requestId: report.requestId,
      tenderId: report.tenderId,
      reportId,
    })

    const extracted = await provider.extractIntelligence(transcription.transcriptText, tenderContext)

    // Ensure stable report ID and processing date stamps.
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
        transcriptionProvider: extracted.sourceAndVerification.transcriptionProvider || transcription.provider,
        processingDate: extracted.sourceAndVerification.processingDate || now2,
      },
    }

    // Standard system disclaimer + certification metadata (not derived from transcript).
    reportContent.importantNotice =
      'Standard disclaimer: This is a system-generated intelligence report draft. Always verify facts against the official tender documents.'
    reportContent.reportCertification = {
      certifiedBy: 'TenderBriefing Intelligence System',
      certificationDate: now2,
      reportVersion: '1.0',
    }

    await docRef.set(
      {
        transcription: {
          provider: transcription.provider,
          rawTranscriptRef: transcriptPath,
          transcriptWordCount: transcription.transcriptWordCount ?? computeWordCount(transcription.transcriptText),
          language: transcription.language,
          confidence: transcription.confidence,
          completedAt: transcription.completedAt,
        },
        reportContent,
        status: 'draft_report',
        draftReadyAt: now2,
        updatedAt: now2,
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
      actorUid: user.uid,
      actorRole: 'admin',
      nextStatus: 'draft_report',
      meta: {
        transcriptWordCount: transcription.transcriptWordCount ?? null,
      },
    })

    return NextResponse.json({ success: true, data: { reportId } })
  } catch (error) {
    const admin = getFirebaseAdmin()
    const db = admin.firestore()
    const reportId = reportIdForFailure
    if (reportId) {
      const now = nowIso()
      const ref = db.collection('briefingIntelligenceReports').doc(reportId)
      const snap = await ref.get()
      const report = snap.exists ? (snap.data() as BriefingIntelligenceReport) : null
      const alreadyInProgressAttempt = report?.status === 'processing'
      const nextAttempts = (report?.processingAttempts || 0) + (alreadyInProgressAttempt ? 0 : 1)
      await ref.set(
        {
          status: 'processing_failed',
          lastError: error instanceof Error ? error.message.slice(0, 2000) : 'Processing failed',
          updatedAt: now,
          processingAttempts: nextAttempts,
          processingStartedAt: report?.processingStartedAt || now,
        },
        { merge: true }
      )
      if (report) {
        await logBriefingIntelligenceAuditEvent({
          db,
          eventType: 'failed',
          reportId,
          requestId: report.requestId,
          agentId: report.agentId,
          smeId: report.smeId,
          actorUid: user?.uid || 'system',
          actorRole: 'admin',
          error: error instanceof Error ? error.message : String(error),
          meta: {},
        })
      }
      await syncSlaForReport({ db, reportId, now: new Date(now) })
    }

    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Processing failed' },
      { status: 500 }
    )
  }
}

