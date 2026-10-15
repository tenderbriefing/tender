import { NextRequest, NextResponse } from 'next/server'
import {
  enforceDistributedPolicy,
  tooManyRequests,
} from '@/lib/security/distributedRateLimit'
import { clientIpFromRequest } from '@/lib/security/rateLimit'
import { logEvent, newRequestId } from '@/lib/observability/logger'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const requestId = newRequestId()
  try {
    const { token } = await context.params
    const ip = clientIpFromRequest(request)
    const limited = await enforceDistributedPolicy('manual-pay-checkout', ip || 'anon')
    if (!limited.allowed) return tooManyRequests(limited.retryAfterSec)

    const body = await request.json().catch(() => ({}))
    if (body?.amount != null || body?.amountCents != null || body?.paymentAmount != null) {
      logEvent({
        event: 'authorisation_denial',
        severity: 'warn',
        requestId,
        outcome: 'denied',
        errorCode: 'client_amount_rejected',
      })
    }

    const service = require('../../../../../backend/services/payments/manualPaymentBookingService')
    const certService = require('../../../../../backend/services/payments/payfastLiveCertificationService')
    const origin =
      process.env.NEXT_PUBLIC_SITE_URL || 'https://www.tenderbriefing.co.za'

    let result = await service.createCheckoutForPaymentToken(token, origin)
    if (!result.ok && result.status === 404) {
      result = await certService.createCheckoutForCertificationToken(token, origin)
    }
    if (!result.ok) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Checkout failed',
          code: result.configured === false ? 'PAYFAST_NOT_CONFIGURED' : 'CHECKOUT_FAILED',
        },
        { status: result.status || 400 }
      )
    }

    if (result.alreadyPaid) {
      return NextResponse.json({
        success: true,
        data: {
          alreadyPaid: true,
          booking: result.request,
        },
      })
    }

    logEvent({
      event: 'payment_initiated',
      requestId,
      outcome: 'success',
      attendanceRequestId:
        result.request?.bookingId || result.request?.id || undefined,
    })

    return NextResponse.json({
      success: true,
      data: {
        alreadyPaid: false,
        booking: result.request,
        formAction: result.formAction,
        fields: result.fields,
        redirectUrl: result.redirectUrl,
        checkoutId: result.checkoutId,
        amountCents: result.amountCents,
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
