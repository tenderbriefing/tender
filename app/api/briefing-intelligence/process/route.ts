import { NextRequest, NextResponse } from 'next/server'
import { verifyApiUser, unauthorizedResponse } from '@/lib/auth/verifyApiUser'
import { processBriefingIntelligenceReport } from '@/lib/briefing-intelligence/processReport'
import {
  createOrResetTranscriptionJob,
  transcriptionJobIdForReport,
} from '@/lib/briefing-intelligence/transcriptionJobs'
import { enqueueTranscriptionWorker } from '@/lib/briefing-intelligence/enqueueTranscription'
import { getFirebaseAdmin } from '@/lib/backend/firebaseAdmin'
import type { BriefingIntelligenceReport } from '@/lib/briefing-intelligence/types'
import { isBriefingAudioTranscriptionEnabled } from '@/lib/briefing-intelligence/featureFlag'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(request: NextRequest) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['admin'])
  if (!user) return unauthorizedResponse('Admin sign-in required')

  try {
    const body = await request.json()
    const reportId = String(body?.reportId || '')
    const force = Boolean(body?.force)

    if (!reportId) {
      return NextResponse.json({ success: false, error: 'reportId is required' }, { status: 400 })
    }

    const admin = getFirebaseAdmin()
    const db = admin.firestore()
    const snap = await db.collection('briefingIntelligenceReports').doc(reportId).get()
    if (!snap.exists) {
      return NextResponse.json({ success: false, error: 'Report not found' }, { status: 404 })
    }
    const report = snap.data() as BriefingIntelligenceReport

    if (isBriefingAudioTranscriptionEnabled() && report.audioFileRef) {
      let job = await createOrResetTranscriptionJob({
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

      if (force && job.status === 'completed') {
        await db.collection('briefingTranscriptionJobs').doc(job.id).set(
          {
            status: 'queued',
            attempts: 0,
            transcriptId: null,
            completedAt: null,
            errorCode: null,
            errorMessage: null,
            updatedAt: new Date().toISOString(),
            nextAttemptAt: new Date().toISOString(),
          },
          { merge: true }
        )
        job = { ...job, status: 'queued', attempts: 0, transcriptId: null }
      }

      // Async path: enqueue worker and return immediately when not forcing sync.
      if (!force && (job.status === 'queued' || job.status === 'retrying')) {
        await enqueueTranscriptionWorker({
          jobId: job.id,
          reportId,
          requestId: report.requestId,
          tenderId: report.tenderId,
        })
        return NextResponse.json({
          success: true,
          data: { reportId, jobId: job.id, enqueued: true },
        })
      }
    }

    // Synchronous admin process (legacy / force).
    const result = await processBriefingIntelligenceReport({
      reportId,
      actorUid: user.uid,
      actorRole: 'admin',
      force,
      jobId: transcriptionJobIdForReport(reportId),
    })

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Processing failed' },
      { status: 500 }
    )
  }
}
