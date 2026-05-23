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

    const requestId = body.requestId
    if (!requestId) {
      return NextResponse.json(
        { success: false, error: 'requestId is required' },
        { status: 400 }
      )
    }

    const updated = await agentService.acceptRequest(requestId, {
      id: params.id,
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
