import { NextRequest, NextResponse } from 'next/server'
import { verifyApiUser, unauthorizedResponse, forbiddenResponse } from '@/lib/auth/verifyApiUser'
import { getFirebaseAdmin } from '@/lib/backend/firebaseAdmin'
import type { BriefingIntelligenceReport, BriefingReport } from '@/lib/briefing-intelligence/types'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { reportId: string } }
) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['admin', 'youth-agent', 'sme'])
  if (!user) return unauthorizedResponse('Sign-in required')

  const reportId = params.reportId
  const admin = getFirebaseAdmin()
  const db = admin.firestore()

  const snap = await db.collection('briefingIntelligenceReports').doc(reportId).get()
  if (!snap.exists) {
    return NextResponse.json({ success: false, error: 'Report not found' }, { status: 404 })
  }

  const report = snap.data() as BriefingIntelligenceReport

  const canView =
    user.userType === 'admin' ||
    (user.userType === 'youth-agent' && report.agentId === user.uid) ||
    (user.userType === 'sme' && report.smeId === user.uid)

  if (!canView) return forbiddenResponse('Not allowed to access this report')

  const content = report.reportContent
  const view: BriefingReport = {
    ...report,
    id: snap.id,
    reviewNotes: report.agentReviewNotes,
    content: report.reportContent,
    slaDueAt: report.slaDeadline,
    slaDeadlineAt: report.slaDeadline,
    date: report.finalizedAt || report.draftReadyAt || report.evidenceSubmittedAt || report.createdAt,
    tenderTitle: content?.coverHeader?.tenderTitle ?? null,
    tenderNumber: content?.coverHeader?.tenderReference ?? null,
    tender:
      content?.coverHeader?.tenderTitle || content?.coverHeader?.tenderReference
        ? {
            title: content?.coverHeader?.tenderTitle ?? null,
            tenderNumber: content?.coverHeader?.tenderReference ?? null,
          }
        : undefined,
  }

  return NextResponse.json({ success: true, data: view })
}

