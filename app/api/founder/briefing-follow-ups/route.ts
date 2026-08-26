import { NextRequest, NextResponse } from 'next/server'
import { verifyFounderUser } from '@/lib/founder/verifyFounder'
import { isBriefingFollowUpUpdatesEnabled } from '@/lib/privateTenders/briefingOpsFlags'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    if (!isBriefingFollowUpUpdatesEnabled()) {
      return NextResponse.json(
        { success: false, error: 'Briefing follow-up updates are not enabled' },
        { status: 404 }
      )
    }
    const access = await verifyFounderUser(request.headers.get('authorization'))
    if ('error' in access) return access.error

    const { searchParams } = new URL(request.url)
    const svc = require('../../../../backend/services/briefingFollowUpUpdateService.js')
    const updates = await svc.listFollowUpUpdates({
      briefingRequestId: searchParams.get('briefingRequestId') || undefined,
      privateTenderId: searchParams.get('privateTenderId') || undefined,
      reviewStatus: searchParams.get('reviewStatus') || undefined,
    })
    return NextResponse.json({ success: true, data: { updates } })
  } catch (error) {
    const status = (error as { status?: number })?.status || 500
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list follow-up updates',
      },
      { status }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isBriefingFollowUpUpdatesEnabled()) {
      return NextResponse.json(
        { success: false, error: 'Briefing follow-up updates are not enabled' },
        { status: 404 }
      )
    }
    const access = await verifyFounderUser(request.headers.get('authorization'))
    if ('error' in access) return access.error

    const body = await request.json()
    const svc = require('../../../../backend/services/briefingFollowUpUpdateService.js')
    const update = await svc.createFollowUpUpdate(body, {
      actorUid: access.user.uid,
      actorEmail: access.user.email,
      actorType: 'founder',
    })
    return NextResponse.json({ success: true, data: { update } }, { status: 201 })
  } catch (error) {
    const status = (error as { status?: number })?.status || 500
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create follow-up update',
      },
      { status }
    )
  }
}
