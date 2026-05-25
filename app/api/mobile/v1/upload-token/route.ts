import { NextRequest, NextResponse } from 'next/server'
import { verifyApiUser, unauthorizedResponse } from '@/lib/auth/verifyApiUser'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['youth-agent', 'admin'])
  if (!user) return unauthorizedResponse('Agent sign-in required')
  try {
    const mobile = require('../../../../../backend/services/mobile/mobileOpsService')
    const body = await request.json()
    const tokenMeta = mobile.createUploadToken(user.uid, body.purpose || 'report')
    await mobile.persistUploadToken(user.uid, tokenMeta)
    return NextResponse.json({
      success: true,
      data: {
        uploadToken: tokenMeta.token,
        expiresAt: tokenMeta.expiresAt,
        purpose: tokenMeta.purpose,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Token failed' },
      { status: 500 }
    )
  }
}
