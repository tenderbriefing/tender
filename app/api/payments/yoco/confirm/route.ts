import { NextRequest, NextResponse } from 'next/server'
import {
  verifyApiUser,
  unauthorizedResponse,
} from '@/lib/auth/verifyApiUser'

export const dynamic = 'force-dynamic'

/** Legacy path — polls request status after redirect (PayFast ITN confirms payment). */
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
      data: { request: existing, paymentStatus: existing.paymentStatus, provider: 'payfast' },
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
