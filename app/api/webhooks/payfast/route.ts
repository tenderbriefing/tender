import { NextRequest, NextResponse } from 'next/server'
import { logEvent, newRequestId } from '@/lib/observability/logger'

export const dynamic = 'force-dynamic'

/**
 * PayFast Instant Transaction Notification (ITN).
 * Must respond quickly; PayFast expects HTTP 200 on accepted notifications.
 * Client browser redirects are never treated as payment confirmation.
 */
export async function POST(request: NextRequest) {
  const requestId = newRequestId()
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
    logEvent({
      event: 'itn_rejected',
      severity: 'warn',
      requestId,
      outcome: 'failure',
      errorCode: 'malformed_payload',
    })
    return new NextResponse('Bad Request', { status: 400 })
  }

  try {
    const paymentService = require('../../../../backend/services/payments/attendancePaymentService')
    const result = await paymentService.processPayfastItn(posted)
    if (!result.ok) {
      logEvent({
        event: 'itn_rejected',
        severity: 'warn',
        requestId,
        outcome: 'failure',
        errorCode: result.reason || 'invalid_itn',
        attendanceRequestId: result.requestId,
        paymentId: posted.pf_payment_id,
      })
      return new NextResponse(result.reason || 'Invalid', { status: 400 })
    }

    logEvent({
      event: result.duplicate
        ? 'duplicate_itn_ignored'
        : result.paymentStatus === 'paid'
          ? 'itn_accepted'
          : 'itn_received',
      requestId,
      outcome: result.duplicate ? 'duplicate' : 'success',
      attendanceRequestId: result.requestId,
      paymentId: posted.pf_payment_id,
      errorCode: result.paymentStatus,
    })
    return new NextResponse('OK', { status: 200 })
  } catch (error) {
    logEvent({
      event: 'itn_rejected',
      severity: 'error',
      requestId,
      outcome: 'failure',
      errorCode: error instanceof Error ? error.message : 'handler_error',
    })
    return new NextResponse('Error', { status: 500 })
  }
}
