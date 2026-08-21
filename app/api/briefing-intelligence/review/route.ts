import { NextRequest, NextResponse } from 'next/server'
import { verifyApiUser, unauthorizedResponse, forbiddenResponse } from '@/lib/auth/verifyApiUser'
import { getFirebaseAdmin } from '@/lib/backend/firebaseAdmin'
import type { BriefingIntelligenceReport } from '@/lib/briefing-intelligence/types'
import { logBriefingIntelligenceAuditEvent } from '@/lib/briefing-intelligence/auditService'

export const dynamic = 'force-dynamic'

function nowIso() {
  return new Date().toISOString()
}

function parseNullableString(v: unknown): string | null {
  if (v === undefined || v === null) return null
  const s = String(v).trim()
  return s ? s : null
}

export async function PATCH(request: NextRequest) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['youth-agent'])
  if (!user) return unauthorizedResponse('Youth Agent sign-in required')

  const body = await request.json()
  const reportId = String(body?.reportId || '')
  if (!reportId) {
    return NextResponse.json({ success: false, error: 'reportId is required' }, { status: 400 })
  }

  const notes = parseNullableString(body?.notes)
  const approve = Boolean(body?.approve)

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

  const now = nowIso()

  if (report.status === 'draft_report') {
    await ref.set(
      {
        agentReviewNotes: notes !== null ? String(notes).slice(0, 8000) : report.agentReviewNotes,
        status: 'agent_review',
        agentReviewedAt: now,
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
      nextStatus: 'agent_review',
      meta: { phase: 'submit_notes' },
    })

    return NextResponse.json({ success: true, data: { reportId, status: 'agent_review' } })
  }

  if (report.status === 'agent_review') {
    if (!approve) {
      // Notes-only update.
      await ref.set(
        {
          agentReviewNotes: notes !== null ? String(notes).slice(0, 8000) : report.agentReviewNotes,
          updatedAt: now,
        },
        { merge: true }
      )
      return NextResponse.json({ success: true, data: { reportId, status: 'agent_review' } })
    }

    const { isBriefingAiReportGenerationEnabled } = await import(
      '@/lib/briefing-intelligence/featureFlag'
    )
    if (isBriefingAiReportGenerationEnabled()) {
      const genStatus = String((report as any).reportGenerationStatus || '')
      if (genStatus !== 'approved') {
        return NextResponse.json(
          {
            success: false,
            error:
              'This AI briefing report requires founder approval before it can be finalised.',
          },
          { status: 409 }
        )
      }
    }

    await ref.set(
      {
        agentReviewNotes: notes !== null ? String(notes).slice(0, 8000) : report.agentReviewNotes,
        status: 'final',
        finalizedAt: now,
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
      meta: { phase: 'approve' },
    })

    return NextResponse.json({ success: true, data: { reportId, status: 'final' } })
  }

  if (report.status === 'final' || report.status === 'delivered') {
    return NextResponse.json({ success: true, data: { reportId, status: report.status, skipped: true } })
  }

  return NextResponse.json(
    { success: false, error: `Cannot review from status ${report.status}` },
    { status: 409 }
  )
}

