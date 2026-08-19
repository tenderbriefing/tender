import { NextRequest, NextResponse } from 'next/server'
import { verifyApiUser, unauthorizedResponse, forbiddenResponse } from '@/lib/auth/verifyApiUser'
import { getFirebaseAdmin } from '@/lib/backend/firebaseAdmin'
import type { BriefingIntelligenceReport } from '@/lib/briefing-intelligence/types'
import { logBriefingIntelligenceAuditEvent } from '@/lib/briefing-intelligence/auditService'

export const dynamic = 'force-dynamic'

function nowIso() {
  return new Date().toISOString()
}

export async function POST(
  request: NextRequest,
  { params }: { params: { reportId: string } }
) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['youth-agent'])
  if (!user) return unauthorizedResponse('Youth Agent sign-in required')

  const reportId = params.reportId
  const body = await request.json().catch(() => ({}))
  const reviewNotes = body?.reviewNotes !== undefined ? String(body.reviewNotes).slice(0, 8000) : null

  const admin = getFirebaseAdmin()
  const db = admin.firestore()
  const ref = db.collection('briefingIntelligenceReports').doc(reportId)
  const snap = await ref.get()
  if (!snap.exists) {
    return NextResponse.json({ success: false, error: 'Report not found' }, { status: 404 })
  }

  const report = snap.data() as BriefingIntelligenceReport
  if (report.agentId !== user.uid) {
    return forbiddenResponse('Not your report')
  }

  if (report.status === 'delivered') {
    return NextResponse.json({ success: true, data: { reportId, skipped: true, status: 'delivered' } })
  }
  if (report.status !== 'draft_report' && report.status !== 'agent_review') {
    return NextResponse.json(
      { success: false, error: `Cannot approve from status ${report.status}` },
      { status: 409 }
    )
  }

  const now = nowIso()

  // One-click approve & finalize for existing UI routes:
  // - If draft_report, transition to final (with agentReviewedAt stamped).
  // - If agent_review, transition to final.
  await ref.set(
    {
      agentReviewNotes: reviewNotes ?? report.agentReviewNotes,
      agentReviewedAt: report.agentReviewedAt || now,
      finalizedAt: now,
      status: 'final',
      updatedAt: now,
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
    actorRole: 'youth-agent',
    nextStatus: 'final',
    meta: { phase: 'approve_finalize' },
  })

  return NextResponse.json({ success: true, data: { reportId, status: 'final' } })
}

