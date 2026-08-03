import { NextRequest, NextResponse } from 'next/server'
import { verifyApiUser, unauthorizedResponse } from '@/lib/auth/verifyApiUser'
import { assertYouthAgentWorkspaceAccess } from '@/lib/agent/workspace/apiGuard'
import {
  canAccessYouthAgentWorkspace,
  isYouthAgentWorkspaceEnabled,
  isYouthAgentWorkspacePilotUser,
  YOUTH_AGENT_WORKSPACE_FLAG_KEY,
} from '@/lib/agent/workspace/featureFlag'

export const dynamic = 'force-dynamic'

/** Probe workspace access (fail-closed). Used by UI bootstrap. */
export async function GET(request: NextRequest) {
  const user = await verifyApiUser(request.headers.get('authorization'), [
    'youth-agent',
    'admin',
  ])
  if (!user) return unauthorizedResponse('Sign-in required')

  const allowed = canAccessYouthAgentWorkspace({ uid: user.uid, userType: user.userType })
  return NextResponse.json({
    success: true,
    data: {
      flagKey: YOUTH_AGENT_WORKSPACE_FLAG_KEY,
      enabled: allowed,
      globalEnabled: isYouthAgentWorkspaceEnabled(),
      pilot: isYouthAgentWorkspacePilotUser(user.uid),
      userType: user.userType,
    },
  })
}

/** Today board */
export async function POST(request: NextRequest) {
  const user = await verifyApiUser(request.headers.get('authorization'), [
    'youth-agent',
    'admin',
  ])
  if (!user) return unauthorizedResponse()
  const denied = assertYouthAgentWorkspaceAccess(user)
  if (denied) return denied

  try {
    const body = await request.json().catch(() => ({}))
    const ws = require('../../../../../backend/services/agentWorkspace/workspaceService')
    const agentId = user.userType === 'admin' && body.agentId ? body.agentId : user.uid
    const data = await ws.getTodayBoard(agentId)
    await ws.recordAnalytics(agentId, 'today_view', {})
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Today board failed' },
      { status: 500 }
    )
  }
}
