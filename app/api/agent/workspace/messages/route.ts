import { NextRequest, NextResponse } from 'next/server'
import { verifyApiUser, unauthorizedResponse } from '@/lib/auth/verifyApiUser'
import { assertYouthAgentWorkspaceAccess } from '@/lib/agent/workspace/apiGuard'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const user = await verifyApiUser(request.headers.get('authorization'), [
    'youth-agent',
    'admin',
  ])
  if (!user) return unauthorizedResponse()
  const denied = assertYouthAgentWorkspaceAccess(user)
  if (denied) return denied

  try {
    const ws = require('../../../../../backend/services/agentWorkspace/workspaceService')
    const requestId = request.nextUrl.searchParams.get('requestId')
    const data = await ws.listMessages(user.uid, requestId)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Messages failed' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const user = await verifyApiUser(request.headers.get('authorization'), [
    'youth-agent',
    'sme',
    'admin',
  ])
  if (!user) return unauthorizedResponse()

  // SME can message on own assignments without full workspace flag
  if (user.userType === 'youth-agent' || user.userType === 'admin') {
    const denied = assertYouthAgentWorkspaceAccess(user)
    if (denied) return denied
  }

  try {
    const body = await request.json()
    const ws = require('../../../../../backend/services/agentWorkspace/workspaceService')
    const data = await ws.sendMessage(
      { uid: user.uid, userType: user.userType },
      {
        requestId: body.requestId,
        body: body.body,
        recipientId: body.recipientId,
      }
    )
    return NextResponse.json({ success: true, data })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Send failed'
    const status = msg.includes('Not allowed') ? 403 : 400
    return NextResponse.json({ success: false, error: msg }, { status })
  }
}
