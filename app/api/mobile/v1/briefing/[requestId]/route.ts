import { NextRequest, NextResponse } from 'next/server'
import { verifyApiUser, unauthorizedResponse, forbiddenResponse } from '@/lib/auth/verifyApiUser'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { requestId: string } }
) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['youth-agent', 'admin'])
  if (!user) return unauthorizedResponse('Agent sign-in required')
  try {
    const field = require('../../../../../../backend/services/mobile/mobileFieldService')
    const data = await field.getBriefingDetail(params.requestId, user.uid)
    if (!data) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    }
    const r = data.request
    const allowed =
      user.userType === 'admin' ||
      r.agentId === user.uid ||
      r.assignedAgentId === user.uid ||
      (Array.isArray(r.notifiedAgents) && r.notifiedAgents.includes(user.uid)) ||
      r.status === 'pending'
    if (!allowed) return forbiddenResponse()
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Load failed' },
      { status: 500 }
    )
  }
}
