import { NextRequest, NextResponse } from 'next/server'
import { isSyncAuthorized, syncAuthErrorResponse } from '@/lib/sync/authorizeSync'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * Scheduler / worker entry for Phase 18 day backfill ticks.
 * Auth: x-sync-secret (same as /api/sync/run).
 *
 * Body:
 * { lookbackDays?: 30, maxDaysPerTick?: 3, force?: false, failedOnly?: false,
 *   dateFrom?, dateTo?, continue?: true }
 *
 * When continue=true and more days remain, returns { continue: true } so the
 * caller/scheduler can re-invoke without holding one 300s process for the full range.
 */
export async function POST(request: NextRequest) {
  if (!isSyncAuthorized(request)) {
    return NextResponse.json(syncAuthErrorResponse(), { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const ctrl = require('../../../../../backend/services/ocdsBackfillController') as {
      planBackfill: (opts: Record<string, unknown>) => Promise<unknown>
      runBackfillTick: (opts: Record<string, unknown>) => Promise<{
        done: boolean
        moreRemaining: boolean
        cursor: unknown
        results: unknown[]
      }>
    }

    if (body.planOnly === true) {
      const planned = await ctrl.planBackfill({
        lookbackDays: Number(body.lookbackDays) || 30,
        dateFrom: body.dateFrom || undefined,
        dateTo: body.dateTo || undefined,
        force: body.force === true,
        failedOnly: body.failedOnly === true,
        cursorId: body.cursorId || 'scheduler',
      })
      return NextResponse.json({ success: true, data: planned })
    }

    // Ensure plan exists then tick
    if (body.ensurePlan !== false) {
      await ctrl.planBackfill({
        lookbackDays: Number(body.lookbackDays) || 30,
        dateFrom: body.dateFrom || undefined,
        dateTo: body.dateTo || undefined,
        force: body.force === true,
        failedOnly: body.failedOnly === true,
        cursorId: body.cursorId || 'scheduler',
      })
    }

    const tick = await ctrl.runBackfillTick({
      lookbackDays: Number(body.lookbackDays) || 30,
      dateFrom: body.dateFrom || undefined,
      dateTo: body.dateTo || undefined,
      force: body.force === true,
      failedOnly: body.failedOnly === true,
      maxDaysPerTick: Number(body.maxDaysPerTick) || 3,
      cursorId: body.cursorId || 'scheduler',
      skipDocuments: body.skipDocuments !== false,
    })

    return NextResponse.json({
      success: true,
      data: tick,
      continue: tick.moreRemaining === true,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Day backfill failed',
      },
      { status: 500 }
    )
  }
}
