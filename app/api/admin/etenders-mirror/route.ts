import { NextRequest, NextResponse } from 'next/server'
import { verifyApiUser, unauthorizedResponse } from '@/lib/auth/verifyApiUser'
import { backend } from '@/lib/backend/loadServices'
import type { TenderBriefing } from '@/lib/tenderBriefing/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

function storage() {
  return backend.getStorage()
}

function matchesQuery(tender: TenderBriefing, q: string) {
  const needle = q.toLowerCase()
  const hay = [
    tender.tenderNumber,
    tender.title,
    tender.description,
    tender.department,
    tender.buyer,
    tender.province,
    tender.ocid,
    tender.status,
    tender.briefingVenue,
  ]
    .map((v) => String(v || '').toLowerCase())
    .join(' | ')
  return hay.includes(needle)
}

/**
 * Admin eTenders mirror:
 * GET ?q=… — search full mirror
 * GET ?view=days&lookbackDays=30 — day reconciliation dashboard
 * GET ?view=exceptions — parity exception queue
 * GET ?view=day&date=YYYY-MM-DD — single day record
 */
export async function GET(request: NextRequest) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['admin'])
  if (!user) return unauthorizedResponse('Admin sign-in required')

  try {
    const { searchParams } = new URL(request.url)
    const view = String(searchParams.get('view') || '').trim()

    if (view === 'days' || view === 'summary') {
      const backfill = require('../../../../backend/services/ocdsBackfillController') as {
        summarizeRange: (from: string, to: string) => Promise<unknown>
      }
      const parity = require('../../../../backend/services/parityReconciliationService') as {
        summarizeParityRange: (from: string, to: string) => Promise<unknown>
      }
      const domain = require('../../../../backend/domain/ocdsDayReconciliation') as {
        lookbackRange: (n: number) => { dateFrom: string; dateTo: string }
      }
      const lookback = Number(searchParams.get('lookbackDays') || 30)
      const range = domain.lookbackRange(lookback)
      const dateFrom = searchParams.get('dateFrom') || range.dateFrom
      const dateTo = searchParams.get('dateTo') || range.dateTo
      const [summary, paritySummary] = await Promise.all([
        backfill.summarizeRange(dateFrom, dateTo),
        parity.summarizeParityRange(dateFrom, dateTo),
      ])
      const bulk = require('../../../../backend/services/ocdsBulkSourceService') as {
        getInvestigationReport: () => unknown
      }
      const website = require('../../../../backend/services/etendersWebsiteSourceService') as {
        getInvestigationReport: () => unknown
      }
      const exceptions = require('../../../../backend/services/parityExceptionService') as {
        summarizeExceptions: () => Promise<unknown>
      }
      return NextResponse.json({
        success: true,
        data: {
          summary,
          paritySummary,
          exceptionSummary: await exceptions.summarizeExceptions(),
          bulkInvestigation: bulk.getInvestigationReport(),
          websiteInvestigation: website.getInvestigationReport(),
          websiteParityNote:
            'OCDS parity ≠ eTenders website parity. See websiteInvestigation.',
        },
      })
    }

    if (view === 'exceptions') {
      const exceptions = require('../../../../backend/services/parityExceptionService') as {
        listOpenExceptions: (opts?: Record<string, unknown>) => Promise<unknown>
        summarizeExceptions: () => Promise<unknown>
      }
      const category = searchParams.get('category') || undefined
      const rows = await exceptions.listOpenExceptions({
        category,
        limit: Number(searchParams.get('limit') || 200),
      })
      return NextResponse.json({
        success: true,
        data: {
          exceptions: rows,
          summary: await exceptions.summarizeExceptions(),
        },
      })
    }

    if (view === 'day') {
      const date = String(searchParams.get('date') || '').slice(0, 10)
      const store = require('../../../../backend/services/ocdsDayStore') as {
        getDayRecord: (d: string) => Promise<unknown>
      }
      const record = await store.getDayRecord(date)
      return NextResponse.json({ success: true, data: { record } })
    }

    const q = String(searchParams.get('q') || '').trim()
    const status = String(searchParams.get('status') || '').trim()
    const derived = String(searchParams.get('derivedBriefingStatus') || '').trim()
    const limit = Math.min(Math.max(1, Number(searchParams.get('limit') || 50)), 200)

    const all = (await storage().getTenderBriefings({ limit: 5000 })) as TenderBriefing[]
    let rows = Array.isArray(all) ? all : []

    if (q) rows = rows.filter((t) => matchesQuery(t, q))
    if (status) {
      rows = rows.filter((t) => String(t.status || '').toLowerCase() === status.toLowerCase())
    }
    if (derived) {
      rows = rows.filter((t) => String(t.derivedBriefingStatus || '') === derived)
    }

    const data = rows.slice(0, limit).map((t) => ({
      id: t.id,
      ocid: t.ocid,
      tenderNumber: t.tenderNumber,
      title: t.title,
      department: t.department,
      province: t.province,
      status: t.status,
      publishedDate: t.publishedDate,
      closingDate: t.closingDate,
      briefingDate: t.briefingDate,
      briefingTime: t.briefingTime,
      briefingVenue: t.briefingVenue,
      sourceBriefingCompulsory: t.sourceBriefingCompulsory ?? null,
      derivedBriefingStatus: t.derivedBriefingStatus || null,
      briefingCompulsory: t.briefingCompulsory === true,
      documentCount: Array.isArray(t.documents) ? t.documents.length : 0,
      lastSyncedAt: t.lastSyncedAt || null,
      detailUrl: t.detailUrl || null,
      rawSourceSnapshot: t.rawSourceSnapshot || null,
      sourceType: (t as TenderBriefing & { sourceType?: string }).sourceType || null,
    }))

    return NextResponse.json({
      success: true,
      data,
      count: data.length,
      totalMatched: rows.length,
      policy: {
        mirrorSearch: true,
        compulsoryFilter: false,
        note: 'Admin mirror includes non-compulsory and past-briefing records',
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Mirror search failed',
      },
      { status: 500 }
    )
  }
}

/**
 * POST actions:
 * reconcile | plan_backfill | backfill_tick | replay_day | historical_backfill
 * | recover_day | run_parity | classify_briefings | run_daily_parity
 */
export async function POST(request: NextRequest) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['admin'])
  if (!user) return unauthorizedResponse('Admin sign-in required')

  try {
    const body = await request.json().catch(() => ({}))
    const action = String(body.action || '').trim()

    if (action === 'reconcile') {
      const recon = require('../../../../backend/services/ocdsMirrorReconciliationService') as {
        reconcileAndSample: (opts: Record<string, unknown>) => Promise<unknown>
      }
      const result = await recon.reconcileAndSample({
        lookbackDays: Number(body.lookbackDays) || 30,
        sampleSize: Number(body.sampleSize) || 25,
        dateFrom: body.dateFrom || undefined,
        dateTo: body.dateTo || undefined,
        maxPages: Number(body.maxPages) || undefined,
      })
      return NextResponse.json({ success: true, data: result, triggeredBy: user.uid })
    }

    if (action === 'plan_backfill') {
      const ctrl = require('../../../../backend/services/ocdsBackfillController') as {
        planBackfill: (opts: Record<string, unknown>) => Promise<unknown>
      }
      const result = await ctrl.planBackfill({
        lookbackDays: Number(body.lookbackDays) || 30,
        dateFrom: body.dateFrom || undefined,
        dateTo: body.dateTo || undefined,
        force: body.force === true,
        failedOnly: body.failedOnly === true,
        cursorId: body.cursorId || 'default',
      })
      return NextResponse.json({ success: true, data: result, triggeredBy: user.uid })
    }

    if (action === 'backfill_tick') {
      const ctrl = require('../../../../backend/services/ocdsBackfillController') as {
        runBackfillTick: (opts: Record<string, unknown>) => Promise<unknown>
      }
      const result = await ctrl.runBackfillTick({
        lookbackDays: Number(body.lookbackDays) || 30,
        dateFrom: body.dateFrom || undefined,
        dateTo: body.dateTo || undefined,
        force: body.force === true,
        failedOnly: body.failedOnly === true,
        maxDaysPerTick: Number(body.maxDaysPerTick) || 3,
        cursorId: body.cursorId || 'default',
        skipDocuments: body.skipDocuments !== false,
      })
      return NextResponse.json({ success: true, data: result, triggeredBy: user.uid })
    }

    if (action === 'replay_day') {
      const replay = require('../../../../backend/services/ocdsDayReplayService') as {
        replayDay: (date: string, opts?: Record<string, unknown>) => Promise<unknown>
      }
      const date = String(body.date || '').slice(0, 10)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return NextResponse.json({ success: false, error: 'date required YYYY-MM-DD' }, { status: 400 })
      }
      const result = await replay.replayDay(date, {
        force: body.force === true,
        skipDocuments: body.skipDocuments !== false,
      })
      return NextResponse.json({ success: true, data: result, triggeredBy: user.uid })
    }

    if (action === 'historical_backfill') {
      const hist = require('../../../../backend/services/ocdsHistoricalBackfillService') as {
        backfillHistoricalSourceFields: (opts?: Record<string, unknown>) => Promise<unknown>
      }
      const result = await hist.backfillHistoricalSourceFields({
        limit: Number(body.limit) || 500,
      })
      return NextResponse.json({ success: true, data: result, triggeredBy: user.uid })
    }

    if (action === 'recover_day') {
      const recovery = require('../../../../backend/services/ocdsSourceRecoveryService') as {
        recoverUnavailableDay: (date: string, opts?: Record<string, unknown>) => Promise<unknown>
      }
      const date = String(body.date || '').slice(0, 10)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return NextResponse.json({ success: false, error: 'date required YYYY-MM-DD' }, { status: 400 })
      }
      const result = await recovery.recoverUnavailableDay(date, {
        force: body.force !== false,
        skipDocuments: body.skipDocuments !== false,
      })
      return NextResponse.json({ success: true, data: result, triggeredBy: user.uid })
    }

    if (action === 'run_parity') {
      const parity = require('../../../../backend/services/parityReconciliationService') as {
        reconcileRange: (opts: Record<string, unknown>) => Promise<unknown>
      }
      const result = await parity.reconcileRange({
        lookbackDays: Number(body.lookbackDays) || 30,
        maxDays: Number(body.maxDays) || 7,
        dateFrom: body.dateFrom || undefined,
        dateTo: body.dateTo || undefined,
      })
      return NextResponse.json({ success: true, data: result, triggeredBy: user.uid })
    }

    if (action === 'classify_briefings') {
      const classify = require('../../../../backend/services/briefingClassificationService') as {
        classifyMirrorBatch: (opts?: Record<string, unknown>) => Promise<unknown>
      }
      const result = await classify.classifyMirrorBatch({
        limit: Number(body.limit) || 500,
        raiseReviews: body.raiseReviews !== false,
      })
      return NextResponse.json({ success: true, data: result, triggeredBy: user.uid })
    }

    if (action === 'run_daily_parity') {
      const job = require('../../../../backend/services/parityDailyJobService') as {
        runDailyParityJob: (opts?: Record<string, unknown>) => Promise<unknown>
      }
      const result = await job.runDailyParityJob({
        lookbackDays: Number(body.lookbackDays) || 30,
        maxDaysPerTick: Number(body.maxDaysPerTick) || 2,
        maxRecoveryDays: Number(body.maxRecoveryDays) || 3,
        maxReconcileDays: Number(body.maxReconcileDays) || 5,
      })
      return NextResponse.json({ success: true, data: result, triggeredBy: user.uid })
    }

    return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Action failed',
      },
      { status: 500 }
    )
  }
}
