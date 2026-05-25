import { NextRequest, NextResponse } from 'next/server'
import { verifyApiUser, unauthorizedResponse } from '@/lib/auth/verifyApiUser'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['youth-agent', 'admin'])
  if (!user) return unauthorizedResponse('Agent sign-in required')
  try {
    const mobile = require('../../../../../backend/services/mobile/mobileOpsService')
    const body = await request.json()
    if (body.action === 'process') {
      const result = await mobile.offlineSync.processOfflineQueue(user.uid)
      return NextResponse.json({ success: true, data: result })
    }
    const queued = await mobile.offlineSync.enqueueOfflineItem({
      agentId: user.uid,
      itemType: body.itemType,
      data: body.data,
      clientTimestamp: body.clientTimestamp,
    })
    return NextResponse.json({ success: true, data: queued })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    )
  }
}
