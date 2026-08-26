import { NextRequest, NextResponse } from 'next/server'
import { verifyFounderUser } from '@/lib/founder/verifyFounder'
import { getFirebaseAdmin } from '@/lib/backend/firebaseAdmin'

export const dynamic = 'force-dynamic'

/**
 * Phase 3H — Founder requests evidence correction from Youth Agent.
 * Does not delete prior evidence; stamps correctionRequired for re-upload.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { reportId: string } }
) {
  try {
    const access = await verifyFounderUser(request.headers.get('authorization'))
    if ('error' in access) return access.error

    const body = await request.json().catch(() => ({}))
    const detail = String(body.detail || body.note || 'Please re-upload briefing evidence.').slice(
      0,
      500
    )
    const admin = getFirebaseAdmin()
    const db = admin.firestore()
    const reportId = params.reportId
    const snap = await db.collection('briefingIntelligenceReports').doc(reportId).get()
    if (!snap.exists) {
      return NextResponse.json({ success: false, error: 'Report not found' }, { status: 404 })
    }
    const report = { id: snap.id, ...snap.data() } as Record<string, any>
    const now = new Date().toISOString()
    await snap.ref.set(
      {
        evidenceCorrectionRequired: true,
        evidenceCorrectionDetail: detail,
        evidenceCorrectionRequestedAt: now,
        evidenceCorrectionRequestedBy: access.user.uid,
        updatedAt: now,
      },
      { merge: true }
    )

    try {
      const lifeNotify = require('../../../../../../backend/services/briefingLifecycleNotificationService')
      await lifeNotify.notifyEvidenceCorrectionSafe({
        reportId,
        requestId: report.requestId,
        tenderTitle: report.tenderTitle,
        detail,
      })
    } catch {
      /* fail-soft */
    }

    try {
      const { backend } = await import('@/lib/backend/loadServices')
      const storage = backend.getStorage()
      const requests = await storage.getAttendanceRequests({})
      const req = (requests || []).find((r: { id: string }) => r.id === report.requestId)
      const users = backend.users()
      const agents = await users.getYouthAgents()
      const agentRow = (agents || []).find(
        (a: Record<string, unknown>) => String(a.id || '') === String(report.agentId || '')
      )
      const agent: { id: string; email?: string | null } = {
        id: String(agentRow?.id || report.agentId || ''),
        email: (agentRow?.email as string | null | undefined) || null,
      }
      if (!agent.email && report.agentId) {
        try {
          const us = await db.collection('users').doc(report.agentId).get()
          if (us.exists) agent.email = us.data()?.email || null
        } catch {
          /* ignore */
        }
      }
      const txEmail = require('../../../../../../backend/services/transactionalEmailService')
      await txEmail.sendYaEvidenceCorrectionEmailSafe(req || { id: report.requestId }, agent, detail, {
        reportId,
      })
    } catch {
      /* fail-soft */
    }

    return NextResponse.json({
      success: true,
      data: { reportId, evidenceCorrectionRequired: true },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to request evidence correction',
      },
      { status: 500 }
    )
  }
}
