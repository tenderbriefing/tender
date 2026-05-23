import { NextRequest, NextResponse } from 'next/server'
import { backend } from '@/lib/backend/loadServices'
import {
  verifyApiUser,
  unauthorizedResponse,
} from '@/lib/auth/verifyApiUser'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await verifyApiUser(request.headers.get('authorization'), ['admin'])
    if (!user) return unauthorizedResponse('Admin sign-in required')

    const body = await request.json()
    if (!body.agentId) {
      return NextResponse.json(
        { success: false, error: 'agentId is required' },
        { status: 400 }
      )
    }

    const agentService = backend.agentAssignment()
    const users = backend.users()
    const agentProfile = await users.getUserById(body.agentId)

    const updated = await agentService.assignRequestToAgent(
      params.id,
      {
        id: body.agentId,
        displayName: body.displayName || agentProfile?.displayName || 'Agent',
        name: body.displayName || agentProfile?.displayName,
        rating: agentProfile?.rating || 3,
      },
      { byAdmin: true }
    )

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Assign failed',
      },
      { status: 400 }
    )
  }
}
