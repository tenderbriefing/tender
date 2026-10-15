import { NextRequest, NextResponse } from 'next/server'
import { verifyApiUser, unauthorizedResponse } from '@/lib/auth/verifyApiUser'

export const dynamic = 'force-dynamic'

/**
 * Founder/Admin — create or inspect the single-use R75 PayFast live certification booking.
 * Does not change commercial R750 pricing.
 */
export async function GET(request: NextRequest) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['admin'])
  if (!user) return unauthorizedResponse('Admin sign-in required')

  try {
    const service = require('../../../../backend/services/payments/payfastLiveCertificationService')
    const gate = await service.getCertificationGate()
    let booking = null
    if (gate.requestId) {
      booking = await service.getCertificationRequestById(gate.requestId)
    }
    return NextResponse.json({
      success: true,
      data: {
        gate,
        commercialPriceCents: service.BRIEFING_PRICE_CENTS,
        certificationAmountCents: service.LIVE_CERTIFICATION_AMOUNT_CENTS,
        booking: booking
          ? {
              id: booking.id,
              paymentStatus: booking.paymentStatus,
              paymentAmount: booking.paymentAmount,
              invoiceNumber: booking.invoiceNumber,
              payfastPaymentId: booking.payfastPaymentId || null,
              paidAt: booking.paidAt || null,
            }
          : null,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load certification gate',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['admin'])
  if (!user) return unauthorizedResponse('Admin sign-in required')

  try {
    const body = await request.json().catch(() => ({}))
    const service = require('../../../../backend/services/payments/payfastLiveCertificationService')

    if (body?.action === 'disable') {
      const gate = await service.disableCertificationPath({
        reason: body?.reason || 'admin_disabled',
        requestId: body?.requestId,
        actorId: user.uid,
      })
      return NextResponse.json({ success: true, data: { gate } })
    }

    const created = await service.createLiveCertificationBooking({
      uid: user.uid,
      email: user.email,
    })

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL || 'https://www.tenderbriefing.co.za'
    const checkout = await service.createCheckoutForCertificationToken(
      created.request.paymentToken,
      origin
    )

    if (!checkout.ok) {
      return NextResponse.json(
        {
          success: false,
          error: checkout.error || 'Checkout failed',
          bookingId: created.request.id,
          paymentUrl: created.paymentUrl,
        },
        { status: checkout.status || 400 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        bookingId: created.request.id,
        invoiceNumber: created.request.invoiceNumber,
        paymentUrl: created.paymentUrl,
        paymentReference: created.paymentReference,
        amountCents: created.amountCents,
        amountLabel: created.amountLabel,
        commercialPriceCents: created.commercialPriceCents,
        formAction: checkout.formAction,
        fields: checkout.fields,
        checkoutId: checkout.checkoutId,
      },
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to create certification booking'
    const status = /disabled|already created|single-use/i.test(message) ? 409 : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
}
