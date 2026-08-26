import { NextRequest, NextResponse } from 'next/server'
import { verifyFounderUser } from '@/lib/founder/verifyFounder'
import { isPrivateTenderBriefingBookingEnabled } from '@/lib/privateTenders/briefingOpsFlags'

export const dynamic = 'force-dynamic'

/**
 * Phase 3C — explainable Youth Agent recommendations for a briefing request.
 * Founder retains final assignment control.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!isPrivateTenderBriefingBookingEnabled()) {
      return NextResponse.json(
        { success: false, error: 'Private tender briefing booking is not enabled' },
        { status: 404 }
      )
    }
    const access = await verifyFounderUser(request.headers.get('authorization'))
    if ('error' in access) return access.error

    const { backend } = await import('@/lib/backend/loadServices')
    const storage = backend.getStorage()
    const users = backend.users()
    const all = await storage.getAttendanceRequests({})
    const requestRow = (all || []).find((r: { id: string }) => r.id === params.id)
    if (!requestRow) {
      return NextResponse.json({ success: false, error: 'Attendance request not found' }, { status: 404 })
    }

    const agents = await users.getYouthAgents()
    const activeAssignments = (all || []).filter((r) => {
      const status = String(r.status || '')
      return (
        Boolean(r.assignedAgentId) &&
        ['assigned', 'accepted', 'in_progress', 'pending'].includes(status)
      )
    })

    const { recommendYouthAgents } = require('../../../../../../backend/services/youthAgentAssignmentRecommendations.js')
    const result = recommendYouthAgents(requestRow, agents, activeAssignments)
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to recommend agents',
      },
      { status: 500 }
    )
  }
}
