import { NextRequest, NextResponse } from 'next/server'
import {
  verifyApiUser,
  unauthorizedResponse,
} from '@/lib/auth/verifyApiUser'
import {
  enforceDistributedPolicy,
  tooManyRequests,
} from '@/lib/security/distributedRateLimit'
import { logEvent, newRequestId } from '@/lib/observability/logger'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const requestId = newRequestId()
  try {
    const user = await verifyApiUser(request.headers.get('authorization'), ['sme'])
    if (!user) return unauthorizedResponse('SME sign-in required')

    const limited = await enforceDistributedPolicy('payment-create', user.uid)
    if (!limited.allowed) return tooManyRequests(limited.retryAfterSec)

    const body = await request.json()
    const attendanceRequestId = body.attendanceRequestId || body.requestId
    if (!attendanceRequestId) {
      return NextResponse.json(
        { success: false, error: 'attendanceRequestId is required' },
        { status: 400 }
      )
    }

    if (body.amount != null || body.amountCents != null || body.paymentAmount != null) {
      logEvent({
        event: 'authorisation_denial',
        severity: 'warn',
        requestId,
        userId: user.uid,
        outcome: 'denied',
        errorCode: 'client_amount_rejected',
        attendanceRequestId,
      })
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
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'PayFast is not configured',
          code: result.configured === false ? 'PAYFAST_NOT_CONFIGURED' : 'CHECKOUT_FAILED',
        },
        { status: result.configured === false ? 503 : 400 }
      )
    }

    logEvent({
      event: 'payment_initiated',
      requestId,
      userId: user.uid,
      attendanceRequestId,
      outcome: 'success',
    })

    return NextResponse.json({
      success: true,
      data: {
        request: result.request,
        formAction: result.formAction,
        fields: result.fields,
        redirectUrl: result.redirectUrl,
        checkoutId: result.checkoutId,
      },
    })
  } catch (error) {
    logEvent({
      event: 'payment_initiated',
      severity: 'error',
      requestId,
      outcome: 'failure',
      errorCode: error instanceof Error ? error.message : 'checkout_error',
    })
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Could not start PayFast checkout',
      },
      { status: 500 }
    )
  }
}
