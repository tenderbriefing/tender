import { NextRequest, NextResponse } from 'next/server'
import { verifyApiUser, unauthorizedResponse } from '@/lib/auth/verifyApiUser'
import { assertYouthAgentWorkspaceAccess } from '@/lib/agent/workspace/apiGuard'

export const dynamic = 'force-dynamic'

type Ctx = { params: { requestId: string } }

export async function GET(request: NextRequest, { params }: Ctx) {
  const user = await verifyApiUser(request.headers.get('authorization'), [
    'youth-agent',
    'admin',
  ])
  if (!user) return unauthorizedResponse()
  const denied = assertYouthAgentWorkspaceAccess(user)
  if (denied) return denied

  try {
    const ws = require('../../../../../../../backend/services/agentWorkspace/workspaceService')
    const agentId =
      user.userType === 'admin'
        ? request.nextUrl.searchParams.get('agentId') || user.uid
        : user.uid
    const data = await ws.getAssignmentDetail(params.requestId, agentId)
    if (!data) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    }
    // Strip AI when no summary present — never invent
    if (!data.aiSummary) data.aiSummary = null
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Detail failed' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const user = await verifyApiUser(request.headers.get('authorization'), [
    'youth-agent',
    'admin',
  ])
  if (!user) return unauthorizedResponse()
  const denied = assertYouthAgentWorkspaceAccess(user)
  if (denied) return denied

  try {
    const body = await request.json()
    const toStatus = body.toStatus || body.status
    if (!toStatus) {
      return NextResponse.json({ success: false, error: 'toStatus required' }, { status: 400 })
    }
    const ws = require('../../../../../../../backend/services/agentWorkspace/workspaceService')
    const agentId = user.userType === 'admin' && body.agentId ? body.agentId : user.uid
    const data = await ws.transitionAssignment(params.requestId, agentId, toStatus, {
      note: body.note,
    })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Transition failed'
    const status = msg.includes('cannot') || msg.includes('Invalid') ? 409 : 400
    return NextResponse.json({ success: false, error: msg }, { status })
  }
}
