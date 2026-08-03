import { NextRequest, NextResponse } from 'next/server'
import { verifyApiUser, unauthorizedResponse } from '@/lib/auth/verifyApiUser'
import { assertYouthAgentWorkspaceAccess } from '@/lib/agent/workspace/apiGuard'

export const dynamic = 'force-dynamic'

export async function PUT(request: NextRequest) {
  const user = await verifyApiUser(request.headers.get('authorization'), [
    'youth-agent',
    'admin',
  ])
  if (!user) return unauthorizedResponse()
  const denied = assertYouthAgentWorkspaceAccess(user)
  if (denied) return denied

  try {
    const body = await request.json()
    const ws = require('../../../../../../backend/services/agentWorkspace/workspaceService')
    const agentId = user.userType === 'admin' && body.agentId ? body.agentId : user.uid
    const data = await ws.saveFieldReportDraft(agentId, body)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Draft save failed'
    const status = msg.includes('locked') ? 409 : 400
    return NextResponse.json({ success: false, error: msg }, { status })
  }
}

export async function POST(request: NextRequest) {
  const user = await verifyApiUser(request.headers.get('authorization'), [
    'youth-agent',
    'admin',
  ])
  if (!user) return unauthorizedResponse()
  const denied = assertYouthAgentWorkspaceAccess(user)
  if (denied) return denied

  try {
    const body = await request.json()
    if (!body.requestId) {
      return NextResponse.json({ success: false, error: 'requestId required' }, { status: 400 })
    }
    const ws = require('../../../../../../backend/services/agentWorkspace/workspaceService')
    const agentId = user.userType === 'admin' && body.agentId ? body.agentId : user.uid
    const data = await ws.submitFieldReport(agentId, body.requestId)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Submit failed'
    const status = msg.includes('locked') ? 409 : 400
    return NextResponse.json({ success: false, error: msg }, { status })
  }
}
