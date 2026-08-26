import { NextRequest, NextResponse } from 'next/server'
import { verifyFounderUser } from '@/lib/founder/verifyFounder'
import { isBriefingFollowUpUpdatesEnabled } from '@/lib/privateTenders/briefingOpsFlags'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!isBriefingFollowUpUpdatesEnabled()) {
      return NextResponse.json(
        { success: false, error: 'Briefing follow-up updates are not enabled' },
        { status: 404 }
      )
    }
    const access = await verifyFounderUser(request.headers.get('authorization'))
    if ('error' in access) return access.error

    const body = await request.json().catch(() => ({}))
    const action = String(body.action || '').trim()
    const svc = require('../../../../../backend/services/briefingFollowUpUpdateService.js')
    const update = await svc.reviewFollowUpUpdate(params.id, action, {
      actorUid: access.user.uid,
      actorEmail: access.user.email,
      note: body.note || body.rejectionReason || '',
    })
    return NextResponse.json({ success: true, data: { update } })
  } catch (error) {
    const status = (error as { status?: number })?.status || 500
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Review failed',
      },
      { status }
    )
  }
}
