import { NextRequest, NextResponse } from 'next/server'
import { verifyFounderUser } from '@/lib/founder/verifyFounder'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const verified = await verifyFounderUser(request.headers.get('authorization'))
  if ('error' in verified) return verified.error

  try {
    const workflow = require('../../../../backend/services/workflowAutomationService')
    const requestedLimit = Number(request.nextUrl.searchParams.get('limit') || 20)
    const data = await workflow.getAutomationOperationalState({
      limit: Math.max(1, Math.min(requestedLimit, 100)),
    })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Automation telemetry unavailable',
      },
      { status: 500 }
    )
  }
}
