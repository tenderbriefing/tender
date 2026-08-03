import { NextRequest, NextResponse } from 'next/server'
import { verifyApiUser, unauthorizedResponse } from '@/lib/auth/verifyApiUser'
import { assertYouthAgentWorkspaceAccess } from '@/lib/agent/workspace/apiGuard'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['admin'])
  if (!user) return unauthorizedResponse('Admin required')
  const denied = assertYouthAgentWorkspaceAccess(user)
  if (denied) return denied

  try {
    const ws = require('../../../../../../backend/services/agentWorkspace/workspaceService')
    const limit = Number(request.nextUrl.searchParams.get('limit') || 40)
    const data = await ws.adminOverview({ limit })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Admin overview failed' },
      { status: 500 }
    )
  }
}
