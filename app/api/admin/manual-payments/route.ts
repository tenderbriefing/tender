import { NextRequest, NextResponse } from 'next/server'
import { verifyApiUser, unauthorizedResponse } from '@/lib/auth/verifyApiUser'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['admin'])
  if (!user) return unauthorizedResponse('Admin sign-in required')

  try {
    const service = require('../../../../backend/services/payments/manualPaymentBookingService')
    const limit = Number(request.nextUrl.searchParams.get('limit') || 100)
    const rows = await service.listManualPaymentRequests({ limit })
    const origin =
      process.env.NEXT_PUBLIC_SITE_URL || 'https://www.tenderbriefing.co.za'
    return NextResponse.json({
      success: true,
      data: {
        bookings: rows.map((r: Record<string, unknown>) =>
          service.toAdminView(r, origin)
        ),
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list manual payments',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['admin'])
  if (!user) return unauthorizedResponse('Admin sign-in required')

  try {
    const body = await request.json()
    const service = require('../../../../backend/services/payments/manualPaymentBookingService')
    const created = await service.createManualPaymentRequest(body, {
      uid: user.uid,
      email: user.email,
    })

    return NextResponse.json({
      success: true,
      data: {
        booking: created.admin,
        paymentUrl: created.paymentUrl,
        invoiceNumber: created.invoiceNumber,
        bookingId: created.request.id,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create payment request'
    const status = /required|valid/i.test(message) ? 400 : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
}
