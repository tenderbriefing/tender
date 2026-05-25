import { NextRequest, NextResponse } from 'next/server'
import { verifyApiUser, unauthorizedResponse } from '@/lib/auth/verifyApiUser'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function GET(request: NextRequest) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['admin'])
  if (!user) return unauthorizedResponse('Admin sign-in required')
  try {
    const aiOps = require('../../../../backend/services/aiOpsExecutiveService')
    const data = await aiOps.getAiOpsExtension()
    return NextResponse.json({
      success: true,
      data: {
        aiInsights: data.aiInsights,
        opportunityTrends: data.aiInsights?.opportunityTrends,
        provinceDemand: data.aiInsights?.provinceDemand,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'AI insights failed' },
      { status: 500 }
    )
  }
}
