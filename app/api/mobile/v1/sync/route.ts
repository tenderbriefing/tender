import { NextRequest, NextResponse } from 'next/server'
import { verifyApiUser, unauthorizedResponse } from '@/lib/auth/verifyApiUser'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['youth-agent', 'admin'])
  if (!user) return unauthorizedResponse('Agent sign-in required')
  try {
    const field = require('../../../../../backend/services/mobile/mobileFieldService')
    const body = await request.json()
    if (body.enqueue) {
      const queued = await field.enqueueSyncItem(user.uid, body.enqueue)
      return NextResponse.json({ success: true, data: queued })
    }
    const result = await field.processSyncQueue(user.uid)
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    )
  }
}
