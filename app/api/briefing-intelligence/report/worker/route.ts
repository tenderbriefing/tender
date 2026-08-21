import { NextRequest, NextResponse } from 'next/server'
import {
  isAutomationAuthorized,
  automationAuthErrorResponse,
} from '@/lib/automation/authorizeAutomation'
import { getFirebaseAdmin } from '@/lib/backend/firebaseAdmin'
import { generateMeetingMinutesReport } from '@/lib/briefing-intelligence/generateMeetingMinutesReport'
import { getReportJob } from '@/lib/briefing-intelligence/reportJobs'
import { isBriefingAiReportGenerationEnabled } from '@/lib/briefing-intelligence/featureFlag'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(request: NextRequest) {
  let authorized = isAutomationAuthorized(request)
  if (!authorized) {
    const { verifyApiUser } = await import('@/lib/auth/verifyApiUser')
    const user = await verifyApiUser(request.headers.get('authorization'), ['admin'])
    if (!user) {
      return NextResponse.json(automationAuthErrorResponse(), { status: 401 })
    }
  }

  if (!isBriefingAiReportGenerationEnabled()) {
    return NextResponse.json(
      { success: false, error: 'Briefing AI report generation is disabled' },
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
  const job = await getReportJob(db, jobId)
  if (!job) {
    return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 })
  }

  if (job.status === 'retrying' && job.nextAttemptAt) {
    const next = new Date(job.nextAttemptAt).getTime()
    if (Number.isFinite(next) && Date.now() < next) {
      const delay = Math.min(30_000, Math.max(0, next - Date.now()))
      await new Promise((r) => setTimeout(r, delay))
    }
  }

  const result = await generateMeetingMinutesReport({
    reportId: job.reportId,
    jobId: job.id,
    actorUid: 'system',
    actorRole: 'system',
  })

  if (result.ok) {
    return NextResponse.json({ success: true, data: result })
  }

  if (result.retryable) {
    const updated = await getReportJob(db, jobId)
    if (updated?.status === 'retrying') {
      const { enqueueReportGenerationWorker } = await import(
        '@/lib/briefing-intelligence/enqueueReportGeneration'
      )
      void enqueueReportGenerationWorker({
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
