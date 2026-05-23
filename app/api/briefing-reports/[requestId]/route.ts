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
  { params }: { params: { requestId: string } }
) {
  try {
    const user = await verifyApiUser(request.headers.get('authorization'))
    if (!user) return unauthorizedResponse()

    const storage = backend.getStorage()
    const agentService = backend.agentAssignment()
    const attendance = await agentService.getRequestById(params.requestId)

    if (!attendance) {
      return NextResponse.json({ success: false, error: 'Request not found' }, { status: 404 })
    }

    const canView =
      user.userType === 'admin' ||
      attendance.smeId === user.uid ||
      attendance.assignedAgentId === user.uid ||
      attendance.agentId === user.uid

    if (!canView) return forbiddenResponse()

    const reports = await storage.getBriefingReports({ requestId: params.requestId })
    return NextResponse.json({ success: true, data: reports })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load reports',
      },
      { status: 500 }
    )
  }
}
