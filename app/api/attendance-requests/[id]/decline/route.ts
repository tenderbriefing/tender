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
    const user = await verifyApiUser(request.headers.get('authorization'), ['youth-agent'])
    if (!user) return unauthorizedResponse('Youth Agent sign-in required')

    const body = await request.json().catch(() => ({}))
    const agentService = backend.agentAssignment()

    const updated = await agentService.declineRequest(
      params.id,
      user.uid,
      body.reason || ''
    )

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
