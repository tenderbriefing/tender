import { NextRequest, NextResponse } from 'next/server'
import {
  verifyApiUser,
  unauthorizedResponse,
} from '@/lib/auth/verifyApiUser'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const user = await verifyApiUser(request.headers.get('authorization'), ['sme'])
    if (!user) return unauthorizedResponse('SME sign-in required')

    const body = await request.json()
    const attendanceRequestId = body.attendanceRequestId || body.requestId
    if (!attendanceRequestId) {
      return NextResponse.json(
        { success: false, error: 'attendanceRequestId is required' },
        { status: 400 }
      )
    }

    const origin =
      request.headers.get('origin') ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      'https://www.tenderbriefing.co.za'

    const paymentService = require('../../../../../backend/services/payments/attendancePaymentService')
    const result = await paymentService.createCheckoutForExistingRequest(
      attendanceRequestId,
      user.uid,
      origin
    )

    if (!result.ok) {
      const status = result.configured === false ? 503 : 400
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Yoco is not configured',
          code: result.configured === false ? 'YOCO_NOT_CONFIGURED' : 'CHECKOUT_FAILED',
        },
        { status }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        redirectUrl: result.redirectUrl,
        checkoutId: result.checkoutId,
        request: result.request,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create checkout',
      },
      { status: 400 }
    )
  }
}
