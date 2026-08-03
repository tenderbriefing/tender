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
    const ws = require('../../../../../../backend/services/agentWorkspace/workspaceService')
    const agentId =
      user.userType === 'admin'
        ? request.nextUrl.searchParams.get('agentId') || user.uid
        : user.uid
    const data = await ws.syncEarningsFromPayouts(agentId)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Earnings failed' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['admin'])
  if (!user) return unauthorizedResponse('Admin required')
  const denied = assertYouthAgentWorkspaceAccess(user)
  if (denied) return denied

  try {
    const body = await request.json()
    if (!body.agentId || body.amountCents == null || !body.type) {
      return NextResponse.json(
        { success: false, error: 'agentId, type, amountCents required' },
        { status: 400 }
      )
    }
    const ws = require('../../../../../../backend/services/agentWorkspace/workspaceService')
    const data = await ws.appendEarningsEntry(body.agentId, {
      type: body.type,
      amountCents: body.amountCents,
      description: body.description,
      requestId: body.requestId,
      createdBy: user.uid,
    })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Ledger append failed' },
      { status: 500 }
    )
  }
}
