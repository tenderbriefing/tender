import { NextRequest, NextResponse } from 'next/server'
import { backend } from '@/lib/backend/loadServices'
import {
  verifyApiUser,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/lib/auth/verifyApiUser'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await verifyApiUser(request.headers.get('authorization'), ['youth-agent'])
    if (!user) return unauthorizedResponse('Youth Agent sign-in required')

    const agentService = backend.agentAssignment()
    const users = backend.users()

    await users.upsertAgentProfile({
      id: user.uid,
      displayName: user.displayName,
      email: user.email,
      province: user.province,
      rating: user.rating || 3,
      userType: 'youth-agent',
    })

    const updated = await agentService.acceptRequest(params.id, {
      id: user.uid,
      displayName: user.displayName,
      name: user.displayName,
      rating: user.rating,
    })

    if (updated.assignedAgentId !== user.uid) {
      return forbiddenResponse('Could not assign this request')
    }

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
