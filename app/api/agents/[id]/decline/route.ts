import { NextRequest, NextResponse } from 'next/server'
import { backend } from '@/lib/backend/loadServices'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const agentService = backend.agentAssignment()

    if (!body.requestId) {
      return NextResponse.json(
        { success: false, error: 'requestId is required' },
        { status: 400 }
      )
    }

    const updated = await agentService.declineRequest(
      body.requestId,
      params.id,
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
