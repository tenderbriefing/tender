import { NextRequest, NextResponse } from 'next/server'
import { verifyApiUser, unauthorizedResponse } from '@/lib/auth/verifyApiUser'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function GET(request: NextRequest) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['admin'])
  if (!user) return unauthorizedResponse('Admin sign-in required')
  try {
    const aiOps = require('../../../../backend/services/aiOpsExecutiveService')
    const liveDispatchTracking = require('../../../../backend/services/fieldOperations/liveDispatchTrackingService')
    const commandCenter = require('../../../../backend/services/commandCenterService')
    const [ext, active, cc] = await Promise.all([
      aiOps.getAiOpsExtension(),
      liveDispatchTracking.getActiveBriefings(),
      commandCenter.getCommandCenterPayload(),
    ])
    return NextResponse.json({
      success: true,
      data: {
        activeBriefings: active,
        dispatchBoard: cc.dispatchBoard,
        dispatchCongestion: ext.dispatchCongestion,
        agentHeatmap: ext.agentHeatmap,
        nationalField: ext.nationalField,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Dispatch load failed' },
      { status: 500 }
    )
  }
}
