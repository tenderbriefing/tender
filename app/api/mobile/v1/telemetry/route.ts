import { NextRequest, NextResponse } from 'next/server'
import { verifyApiUser, unauthorizedResponse } from '@/lib/auth/verifyApiUser'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['youth-agent', 'admin'])
  if (!user) return unauthorizedResponse('Agent sign-in required')
  try {
    const field = require('../../../../../backend/services/mobile/mobileFieldService')
    const body = await request.json()
    const data = await field.recordTelemetry(user.uid, body.event || 'mobile_event', body.metadata || {}, body.sessionId)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Telemetry failed' },
      { status: 500 }
    )
  }
}
