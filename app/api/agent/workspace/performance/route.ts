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
    const data = await ws.getExplainablePerformance(agentId)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Performance failed' },
      { status: 500 }
    )
  }
}
