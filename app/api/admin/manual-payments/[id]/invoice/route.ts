import { NextRequest, NextResponse } from 'next/server'
import { verifyApiUser, unauthorizedResponse } from '@/lib/auth/verifyApiUser'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await verifyApiUser(_request.headers.get('authorization'), ['admin'])
  if (!user) return unauthorizedResponse('Admin sign-in required')

  try {
    const { id } = await context.params
    const service = require('../../../../../../backend/services/payments/manualPaymentBookingService')
    const booking = await service.getManualRequestById(id)
    if (!booking) {
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
