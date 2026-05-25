import { NextRequest, NextResponse } from 'next/server'
import {
  verifyApiUser,
  unauthorizedResponse,
} from '@/lib/auth/verifyApiUser'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['admin'])
  if (!user) return unauthorizedResponse('Admin sign-in required')

  try {
    const pilotCrm = require('../../../../../backend/services/pilotCrmService')
    const body = await request.json()
    const { leadId, messageType, sendWhatsApp } = body
    if (!leadId || !messageType) {
      return NextResponse.json(
        { success: false, error: 'leadId and messageType required' },
        { status: 400 }
      )
    }
    const result = await pilotCrm.sendLeadOutreach({
      leadId,
      messageType,
      sendWhatsApp: Boolean(sendWhatsApp),
      adminUid: user.uid,
    })
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Outreach failed' },
      { status: 500 }
    )
  }
}
