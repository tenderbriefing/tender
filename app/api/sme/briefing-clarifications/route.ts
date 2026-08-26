import { NextRequest, NextResponse } from 'next/server'
import {
  verifyApiUser,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/lib/auth/verifyApiUser'
import { isBriefingFollowUpUpdatesEnabled } from '@/lib/privateTenders/briefingOpsFlags'

export const dynamic = 'force-dynamic'

/**
 * Phase 3H — SME requests a clarification on their briefing service.
 * Creates a pending follow-up for Founder review (does not mutate approved report).
 */
export async function POST(request: NextRequest) {
  try {
    if (!isBriefingFollowUpUpdatesEnabled()) {
      return NextResponse.json(
        { success: false, error: 'Briefing follow-up updates are not enabled' },
        { status: 404 }
      )
    }
    const user = await verifyApiUser(request.headers.get('authorization'), ['sme', 'admin'])
    if (!user) return unauthorizedResponse()
    if (user.userType !== 'sme' && user.userType !== 'admin') return forbiddenResponse()

    const body = await request.json()
    const briefingRequestId = String(body.briefingRequestId || body.requestId || '').trim()
    const title = String(body.title || '').trim()
    const content = String(body.content || '').trim()
    if (!briefingRequestId || !title || !content) {
      return NextResponse.json(
        { success: false, error: 'briefingRequestId, title and content are required' },
        { status: 400 }
      )
    }

    const { backend } = await import('@/lib/backend/loadServices')
    const storage = backend.getStorage()
    const all = await storage.getAttendanceRequests({ smeId: user.uid })
    const owned = (all || []).find((r: { id: string }) => r.id === briefingRequestId)
    if (!owned && user.userType !== 'admin') {
      return forbiddenResponse('Attendance request not found for this SME')
    }
    const row = owned || (await storage.getAttendanceRequests({})).find((r: { id: string }) => r.id === briefingRequestId)
    if (!row) {
      return NextResponse.json({ success: false, error: 'Attendance request not found' }, { status: 404 })
    }

    const svc = require('../../../../backend/services/briefingFollowUpUpdateService.js')
    const update = await svc.createFollowUpUpdate(
      {
        privateTenderId: (row as { privateTenderId?: string }).privateTenderId || null,
        privateSubmissionId: (row as { privateSubmissionId?: string }).privateSubmissionId || null,
        briefingRequestId,
        organisationId: (row as { organisationId?: string }).organisationId || null,
        smeId: user.uid,
        updateType: 'clarification_request',
        title,
        content,
      },
      {
        actorUid: user.uid,
        actorEmail: user.email,
        actorType: 'sme',
      }
    )

    return NextResponse.json({ success: true, data: { update } }, { status: 201 })
  } catch (error) {
    const status = (error as { status?: number })?.status || 500
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to request clarification',
      },
      { status }
    )
  }
}
