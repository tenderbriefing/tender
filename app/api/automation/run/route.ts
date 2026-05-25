import { NextRequest, NextResponse } from 'next/server'
import {
  isAutomationAuthorized,
  automationAuthErrorResponse,
} from '@/lib/automation/authorizeAutomation'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(request: NextRequest) {
  if (!isAutomationAuthorized(request)) {
    return NextResponse.json(automationAuthErrorResponse(), { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const workflow = require('../../../../backend/services/workflowAutomationService')
    const job = body.job || 'all'
    const results = await workflow.runScheduledAutomation(job)

    return NextResponse.json({
      success: true,
      job,
      results,
      ranAt: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Automation run failed',
      },
      { status: 500 }
    )
  }
}
