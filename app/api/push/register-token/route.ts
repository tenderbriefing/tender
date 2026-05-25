import { NextRequest, NextResponse } from 'next/server'
import {
  verifyApiUser,
  unauthorizedResponse,
} from '@/lib/auth/verifyApiUser'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const user = await verifyApiUser(request.headers.get('authorization'))
  if (!user) return unauthorizedResponse('Sign-in required')

  try {
    const body = await request.json()
    const token = body.token || body.fcmToken
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'token is required' },
        { status: 400 }
      )
    }

    const push = require('../../../../backend/services/pushNotificationService')
    const result = await push.registerToken(user.uid, String(token), {
      platform: body.platform || 'web',
    })

    return NextResponse.json({ success: result.ok !== false, data: result })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Token registration failed',
      },
      { status: 500 }
    )
  }
}
