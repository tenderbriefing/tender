import { NextRequest, NextResponse } from 'next/server'
import { verifyApiUser, unauthorizedResponse } from '@/lib/auth/verifyApiUser'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['admin'])
  if (!user) return unauthorizedResponse('Admin sign-in required')

  try {
    const { id } = await context.params
    const body = await request.json().catch(() => ({}))
    const service = require('../../../../../../backend/services/payments/manualPaymentBookingService')
    const result = await service.emailInvoiceAndPaymentLink(id, {
      force: body?.force === true,
      baseUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://www.tenderbriefing.co.za',
    })
    return NextResponse.json({
      success: true,
      data: {
        email: result.result,
        paymentUrl: result.paymentUrl,
        booking: result.request,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Email send failed',
      },
      { status: 500 }
    )
  }
}
