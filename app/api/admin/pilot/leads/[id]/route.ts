import { NextRequest, NextResponse } from 'next/server'
import {
  verifyApiUser,
  unauthorizedResponse,
} from '@/lib/auth/verifyApiUser'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['admin'])
  if (!user) return unauthorizedResponse('Admin sign-in required')

  try {
    const pilotCrm = require('../../../../../../backend/services/pilotCrmService')
    const lead = await pilotCrm.getLead(params.id)
    if (!lead) {
      return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 })
    }
    const timeline = await pilotCrm.listOutreachForLead(params.id)
    return NextResponse.json({ success: true, data: { lead, timeline } })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to load lead' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['admin'])
  if (!user) return unauthorizedResponse('Admin sign-in required')

  try {
    const pilotCrm = require('../../../../../../backend/services/pilotCrmService')
    const body = await request.json()
    const lead = await pilotCrm.updateLead(params.id, body, user.uid)
    return NextResponse.json({ success: true, data: lead })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update lead' },
      { status: 500 }
    )
  }
}
