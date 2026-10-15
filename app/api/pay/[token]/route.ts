import { NextRequest, NextResponse } from 'next/server'
import {
  enforceDistributedPolicy,
  tooManyRequests,
} from '@/lib/security/distributedRateLimit'
import { clientIpFromRequest } from '@/lib/security/rateLimit'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params
    const ip = clientIpFromRequest(request)
    const limited = await enforceDistributedPolicy('manual-pay-view', ip || 'anon')
    if (!limited.allowed) return tooManyRequests(limited.retryAfterSec)

    const service = require('../../../../backend/services/payments/manualPaymentBookingService')
    const certService = require('../../../../backend/services/payments/payfastLiveCertificationService')
    let booking = await service.getRequestByPaymentToken(token)
    if (!booking || booking.source !== service.MANUAL_SOURCE) {
      booking = await certService.getRequestByPaymentToken(token)
    }
    if (!booking) {
      return NextResponse.json({ success: false, error: 'Payment link not found' }, { status: 404 })
    }

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL || 'https://www.tenderbriefing.co.za'
    return NextResponse.json({
      success: true,
      data: service.toPublicPaymentView(booking, origin),
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load payment',
      },
      { status: 500 }
    )
  }
}
