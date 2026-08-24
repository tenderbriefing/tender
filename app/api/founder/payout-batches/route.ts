import { NextRequest, NextResponse } from 'next/server'
import { verifyFounderUser } from '@/lib/founder/verifyFounder'

export const dynamic = 'force-dynamic'

const BATCH_STATUSES = new Set(['all', 'ready', 'paid', 'cancelled'])

export async function GET(request: NextRequest) {
  try {
    const access = await verifyFounderUser(request.headers.get('authorization'))
    if ('error' in access) return access.error

    const { searchParams } = new URL(request.url)
    const periodKey = searchParams.get('periodKey')
    const statusRaw = searchParams.get('status') || 'all'
    const status = BATCH_STATUSES.has(statusRaw) ? statusRaw : 'all'
    const youthAgentUid = searchParams.get('youthAgentUid')

    const svc = require('../../../../../backend/services/finance/youthAgentPayoutBatchService.js')
    const data = await svc.listBatches({
      periodKey: periodKey || null,
      status: status === 'all' ? null : status,
      youthAgentUid: youthAgentUid || null,
      pageSize: 100,
    })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list payout batches',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await verifyFounderUser(request.headers.get('authorization'))
    if ('error' in access) return access.error

    const body = await request.json().catch(() => ({}))
    const periodKey = String(body.periodKey || body.period || '').trim()
    if (!/^\d{4}-\d{2}$/.test(periodKey)) {
      return NextResponse.json(
        { success: false, error: 'periodKey (YYYY-MM) is required' },
        { status: 400 }
      )
    }

    const svc = require('../../../../../backend/services/finance/youthAgentPayoutBatchService.js')
    const result = await svc.generateMonthlyBatches({
      periodKey,
      actorUid: access.user.uid,
    })

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate monthly batches',
      },
      { status: 500 }
    )
  }
}
