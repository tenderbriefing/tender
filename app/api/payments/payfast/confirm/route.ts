import { NextRequest, NextResponse } from 'next/server'
import {
  verifyApiUser,
  unauthorizedResponse,
} from '@/lib/auth/verifyApiUser'

export const dynamic = 'force-dynamic'

/**
 * SME return URL — re-check request after PayFast redirect.
 * PayFast primary confirmation is ITN; this handles lag until notify_url fires.
 */
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

    const storage = require('../../../../../backend/services/storageAdapter').getStorage()
    const requests = await storage.getAttendanceRequests({ smeId: user.uid })
    const existing = requests.find((r: { id: string }) => r.id === requestId)
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Attendance request not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        request: existing,
        paymentStatus: existing.paymentStatus,
        message:
          existing.paymentStatus === 'paid'
            ? 'Payment confirmed'
            : 'Waiting for PayFast confirmation — refresh shortly if you completed payment',
      },
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
