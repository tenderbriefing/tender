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
    const limited = await enforceDistributedPolicy('manual-pay-invoice', ip || 'anon')
    if (!limited.allowed) return tooManyRequests(limited.retryAfterSec)

    const service = require('../../../../../backend/services/payments/manualPaymentBookingService')
    const booking = await service.getRequestByPaymentToken(token)
    if (!booking || booking.source !== service.MANUAL_SOURCE) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    }

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL || 'https://www.tenderbriefing.co.za'
    const pdf = await service.buildInvoicePdfBuffer(booking, origin)
    const filename = `${booking.invoiceNumber || booking.id}.pdf`
    return new NextResponse(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Invoice PDF failed',
      },
      { status: 500 }
    )
  }
}
