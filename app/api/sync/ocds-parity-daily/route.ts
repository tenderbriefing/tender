import { NextRequest, NextResponse } from 'next/server'
import { isSyncAuthorized, syncAuthErrorResponse } from '@/lib/sync/authorizeSync'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * Phase 19 daily parity job.
 * Auth: x-sync-secret (same as /api/sync/run).
 */
export async function POST(request: NextRequest) {
  if (!isSyncAuthorized(request)) {
    return NextResponse.json(syncAuthErrorResponse(), { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const job = require('../../../../backend/services/parityDailyJobService') as {
      runDailyParityJob: (opts: Record<string, unknown>) => Promise<unknown>
    }

    const result = await job.runDailyParityJob({
      lookbackDays: Number(body.lookbackDays) || 30,
      maxDaysPerTick: Number(body.maxDaysPerTick) || 2,
      maxRecoveryDays: Number(body.maxRecoveryDays) || 3,
      maxReconcileDays: Number(body.maxReconcileDays) || 5,
      forceRecovery: body.forceRecovery === true,
      cursorId: body.cursorId || 'parity-daily',
    })

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Parity daily job failed',
      },
      { status: 500 }
    )
  }
}
