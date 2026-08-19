import { NextRequest, NextResponse } from 'next/server'
import { verifyFounderUser } from '@/lib/founder/verifyFounder'
import { FOUNDER_DASHBOARD_PERIODS, type FounderDashboardPeriod } from '@/lib/founder/dashboard'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const VIEWS = new Set(['overview', 'smes', 'agents', 'briefings', 'detail'])

export async function GET(request: NextRequest) {
  try {
    const access = await verifyFounderUser(request.headers.get('authorization'))
    if ('error' in access) return access.error

    const { searchParams } = new URL(request.url)
    const viewRaw = searchParams.get('view') || 'overview'
    const view = VIEWS.has(viewRaw) ? viewRaw : 'overview'
    const periodRaw = searchParams.get('period') || '30'
    const period = (FOUNDER_DASHBOARD_PERIODS as readonly string[]).includes(periodRaw)
      ? (periodRaw as FounderDashboardPeriod)
      : '30'

    const started = Date.now()
    const svc = require('../../../../backend/services/founderDashboardService.js')
    const data = await svc.getFounderDashboard({
      view,
      period,
      page: Number(searchParams.get('page') || 1),
      pageSize: Number(searchParams.get('pageSize') || 25),
      q: searchParams.get('q') || '',
      province: searchParams.get('province') || '',
      kind: searchParams.get('kind') || '',
      id: searchParams.get('id') || '',
    })

    const { logHotPath } = require('../../../../backend/services/hotPathLog')
    logHotPath({
      endpoint: 'founder_dashboard_v2',
      durationMs: Date.now() - started,
      resultCount:
        data?.smes?.items?.length ??
        data?.agents?.items?.length ??
        data?.briefings?.items?.length ??
        data?.overview?.needsAttention?.length,
      role: 'founder',
    })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load founder dashboard',
      },
      { status: 500 }
    )
  }
}
