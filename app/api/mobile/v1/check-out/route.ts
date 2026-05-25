import { NextRequest, NextResponse } from 'next/server'
import { verifyApiUser, unauthorizedResponse } from '@/lib/auth/verifyApiUser'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['youth-agent', 'admin'])
  if (!user) return unauthorizedResponse('Agent sign-in required')
  try {
    const mobile = require('../../../../../backend/services/mobile/mobileOpsService')
    const body = await request.json()
    const log = await mobile.gpsAttendance.recordGpsEvent({
      ...body,
      agentId: user.uid,
      eventType: 'check_out',
    })
    await mobile.recordMobileTelemetry(user.uid, 'check_out', { requestId: body.requestId })
    return NextResponse.json({ success: true, data: log })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Check-out failed' },
      { status: 500 }
    )
  }
}
