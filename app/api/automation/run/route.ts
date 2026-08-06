import { NextRequest, NextResponse } from 'next/server'
import {
  isAutomationAuthorized,
  automationAuthErrorResponse,
} from '@/lib/automation/authorizeAutomation'
import { randomUUID } from 'node:crypto'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(request: NextRequest) {
  if (!isAutomationAuthorized(request)) {
    return NextResponse.json(automationAuthErrorResponse(), { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const workflow = require('../../../../backend/services/workflowAutomationService')
    const job = typeof body?.job === 'string' && body.job.trim() ? body.job.trim() : 'all'
    if (!workflow.validateJobName(job)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid automation job',
          job,
          validJobs: ['all', ...workflow.listJobs().map((entry: { name: string }) => entry.name)],
        },
        { status: 400 }
      )
    }
    if (body?.continuation != null && typeof body.continuation !== 'string') {
      return NextResponse.json(
        { success: false, error: 'continuation must be a string' },
        { status: 400 }
      )
    }

    const requestId =
      request.headers.get('x-request-id')?.slice(0, 128) ||
      request.headers.get('x-cloud-trace-context')?.split('/')[0]?.slice(0, 128) ||
      randomUUID()
    const runId = randomUUID()
    const results = await workflow.runScheduledAutomation(job, {
      runId,
      continuation: body?.continuation || null,
    })

    return NextResponse.json(
      {
        success: true,
        job,
        status: results?.status ?? 'completed',
        runId: results?.runId || runId,
        requestId,
        continuation: results?.continuation || null,
        results,
        ranAt: new Date().toISOString(),
      },
      {
        status: 200,
        headers: {
          'x-request-id': requestId,
          'x-automation-run-id': results?.runId || runId,
          'x-automation-status': results?.status ?? 'completed',
          'cache-control': 'no-store',
        },
      }
    )
  } catch (error) {
    const invalidJob =
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'INVALID_AUTOMATION_JOB'
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Automation run failed',
      },
      { status: invalidJob ? 400 : 500 }
    )
  }
}
