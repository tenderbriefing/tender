import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * PayFast Instant Transaction Notification (ITN).
 * Must respond quickly; PayFast expects HTTP 200.
 */
export async function POST(request: NextRequest) {
  let posted: Record<string, string> = {}
  try {
    const contentType = request.headers.get('content-type') || ''
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await request.text()
      const params = new URLSearchParams(text)
      posted = Object.fromEntries(params.entries())
    } else if (contentType.includes('application/json')) {
      posted = (await request.json()) as Record<string, string>
    } else {
      const text = await request.text()
      const params = new URLSearchParams(text)
      posted = Object.fromEntries(params.entries())
    }
  } catch {
    return new NextResponse('Bad Request', { status: 400 })
  }

  try {
    const paymentService = require('../../../../backend/services/payments/attendancePaymentService')
    const result = await paymentService.processPayfastItn(posted)
    if (!result.ok) {
      console.warn('[payfast itn] rejected:', result.reason)
      return new NextResponse(result.reason || 'Invalid', { status: 400 })
    }
    return new NextResponse('OK', { status: 200 })
  } catch (error) {
    console.error(
      '[payfast itn] handler error:',
      error instanceof Error ? error.message : error
    )
    return new NextResponse('Error', { status: 500 })
  }
}
