import { NextRequest, NextResponse } from 'next/server'
import {
  verifyApiUser,
  unauthorizedResponse,
} from '@/lib/auth/verifyApiUser'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET(request: NextRequest) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['admin'])
  if (!user) return unauthorizedResponse('Admin sign-in required')

  try {
    const started = Date.now()
    const commandCenter = require('../../../../backend/services/commandCenterService')
    const data = await commandCenter.getCommandCenterPayload()
    const { logHotPath } = require('../../../../backend/services/hotPathLog')
    logHotPath({
      endpoint: 'command-center',
      durationMs: Date.now() - started,
      resultCount: Array.isArray(data?.pendingQueue) ? data.pendingQueue.length : 0,
      role: 'admin',
    })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Command center load failed',
      },
      { status: 500 }
    )
  }
}
