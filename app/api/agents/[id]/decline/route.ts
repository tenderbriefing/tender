import { NextRequest, NextResponse } from 'next/server'
import { backend } from '@/lib/backend/loadServices'
import { ensureRouteAccess, isAccessDenied } from '@/lib/auth/ensureRouteAccess'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const access = await ensureRouteAccess(request, {
    allowedTypes: ['youth-agent', 'admin'],
    matchAgentIdParam: params.id,
  })
  if (isAccessDenied(access)) return access

  try {
    const body = await request.json()
    const agentService = backend.agentAssignment()

    const requestId = body.requestId
    if (!requestId) {
      return NextResponse.json(
        { success: false, error: 'requestId is required' },
        { status: 400 }
      )
    }

    const agentId = access.userType === 'admin' ? params.id : access.uid
    const updated = await agentService.declineRequest(requestId, agentId, body.reason)

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Decline failed',
      },
      { status: 400 }
    )
  }
}
