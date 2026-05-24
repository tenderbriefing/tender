import { NextRequest, NextResponse } from 'next/server'
import {
  verifyApiUser,
  unauthorizedResponse,
} from '@/lib/auth/verifyApiUser'

export const dynamic = 'force-dynamic'

/** SME return URL — verify checkout with Yoco when webhook may be delayed. */
export async function POST(request: NextRequest) {
  try {
    const user = await verifyApiUser(request.headers.get('authorization'), ['sme'])
    if (!user) return unauthorizedResponse('SME sign-in required')

    const body = await request.json()
    const requestId = body.requestId
    if (!requestId) {
      return NextResponse.json(
        { success: false, error: 'requestId is required' },
        { status: 400 }
      )
    }

    const paymentService = require('../../../../../backend/services/payments/attendancePaymentService')
    const storage = require('../../../../../backend/services/storageAdapter').getStorage()
    const requests = await storage.getAttendanceRequests({ smeId: user.uid })
    const existing = requests.find((r: { id: string }) => r.id === requestId)
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Attendance request not found' },
        { status: 404 }
      )
    }

    if (existing.paymentStatus === 'paid') {
      return NextResponse.json({
        success: true,
        data: { request: existing, paymentStatus: 'paid' },
      })
    }

    const checkoutId = existing.yocoCheckoutId || body.checkoutId
    if (!checkoutId) {
      return NextResponse.json({
        success: true,
        data: { request: existing, paymentStatus: existing.paymentStatus },
      })
    }

    const yoco = require('../../../../../backend/services/integrations/yocoService')
    const checkoutResult = await yoco.getCheckout(checkoutId)
    if (!checkoutResult.ok) {
      return NextResponse.json({
        success: true,
        data: { request: existing, paymentStatus: existing.paymentStatus },
      })
    }

    const status = String(
      checkoutResult.checkout?.status || checkoutResult.checkout?.paymentStatus || ''
    ).toLowerCase()

    if (status === 'completed' || status === 'successful' || status === 'paid') {
      const paid = await paymentService.markRequestPaid(requestId, {
        checkoutId,
        source: 'return_url',
      })
      return NextResponse.json({
        success: true,
        data: { request: paid.request, paymentStatus: 'paid' },
      })
    }

    return NextResponse.json({
      success: true,
      data: { request: existing, paymentStatus: existing.paymentStatus },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Payment confirmation failed',
      },
      { status: 500 }
    )
  }
}
