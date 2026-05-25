import { NextRequest, NextResponse } from 'next/server'
import { verifyApiUser, unauthorizedResponse } from '@/lib/auth/verifyApiUser'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['youth-agent', 'admin'])
  if (!user) return unauthorizedResponse('Agent sign-in required')
  try {
    const mobile = require('../../../../../backend/services/mobile/mobileOpsService')
    const data = await mobile.getAgentDispatch(user.uid)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Dispatch failed' },
      { status: 500 }
    )
  }
}
