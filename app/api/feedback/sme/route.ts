import { NextRequest, NextResponse } from 'next/server'
import {
  verifyApiUser,
  unauthorizedResponse,
} from '@/lib/auth/verifyApiUser'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['sme', 'admin'])
  if (!user) return unauthorizedResponse('Sign in required')

  try {
    const pilotCrm = require('../../../../backend/services/pilotCrmService')
    const body = await request.json()
    const feedback = await pilotCrm.submitFeedback({
      ...body,
      feedbackType: 'sme',
      userId: user.uid,
    })
    return NextResponse.json({ success: true, data: { id: feedback.id } })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Feedback failed' },
      { status: 500 }
    )
  }
}
