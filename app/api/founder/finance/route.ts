import { NextRequest, NextResponse } from 'next/server'
import { verifyFounderUser } from '@/lib/founder/verifyFounder'

export const dynamic = 'force-dynamic'

const STATUSES = new Set([
  'all',
  'pending',
  'eligible',
  'held',
  'batched',
  'settled',
  'paid',
  'cancelled',
])
const BATCH_STATUSES = new Set(['all', 'ready', 'paid', 'cancelled'])

export async function GET(request: NextRequest) {
  try {
    const access = await verifyFounderUser(request.headers.get('authorization'))
    if ('error' in access) return access.error

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '30'
    const statusRaw = searchParams.get('status') || 'all'
    const status = STATUSES.has(statusRaw) ? statusRaw : 'all'
    const batchPeriodKey = searchParams.get('batchPeriodKey')
    const batchStatusRaw = searchParams.get('batchStatus') || 'all'
    const batchStatus = BATCH_STATUSES.has(batchStatusRaw) ? batchStatusRaw : 'all'
    const page = Number(searchParams.get('page') || 1)
    const pageSize = Number(searchParams.get('pageSize') || 25)

    const svc = require('../../../../../backend/services/founderFinanceService.js')
    const data = await svc.getFounderFinanceDashboard({
      period,
      status,
      page,
      pageSize,
      batchPeriodKey: batchPeriodKey || null,
      batchStatus,
    })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load finance dashboard',
      },
      { status: 500 }
    )
  }
}
