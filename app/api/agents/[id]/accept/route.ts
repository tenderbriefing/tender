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
    const updated = await agentService.acceptRequest(requestId, {
      id: agentId,
      displayName: body.displayName || body.agentName,
      name: body.agentName,
      rating: body.rating,
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Accept failed',
      },
      { status: 400 }
    )
  }
}
