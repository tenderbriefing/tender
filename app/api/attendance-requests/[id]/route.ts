import { NextRequest, NextResponse } from 'next/server'
import { backend } from '@/lib/backend/loadServices'
import {
  verifyApiUser,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/lib/auth/verifyApiUser'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await verifyApiUser(request.headers.get('authorization'))
    if (!user) return unauthorizedResponse()

    const agentService = backend.agentAssignment()
    const req = await agentService.getRequestById(params.id)
    if (!req) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    }

    const canView =
      user.userType === 'admin' ||
      req.smeId === user.uid ||
      req.assignedAgentId === user.uid ||
      req.agentId === user.uid

    if (!canView) return forbiddenResponse()

    const storage = backend.getStorage()
    const reports = await storage.getBriefingReports({ requestId: params.id })

    const { enrichAttendanceRequests } = await import('@/lib/backend/enrichAttendanceRequests')
    const [enrichedRequest] = await enrichAttendanceRequests([req])

    return NextResponse.json({
      success: true,
      data: { request: enrichedRequest, reports },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load request',
      },
      { status: 500 }
    )
  }
}
