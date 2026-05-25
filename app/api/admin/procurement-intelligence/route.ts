import { NextRequest, NextResponse } from 'next/server'
import { verifyApiUser, unauthorizedResponse } from '@/lib/auth/verifyApiUser'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function GET(request: NextRequest) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['admin'])
  if (!user) return unauthorizedResponse('Admin sign-in required')
  try {
    const intelligence = require('../../../../backend/services/procurementIntelligenceService')
    const data = await intelligence.getDashboardPayload()
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Load failed' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['admin'])
  if (!user) return unauthorizedResponse('Admin sign-in required')
  try {
    const body = await request.json().catch(() => ({}))
    const aggregation = require('../../../../backend/services/procurement/procurementAggregationService')
    if (body.action === 'run_ingestion') {
      const result = await aggregation.runSmartProcurementIngestion({
        sourceIds: body.sourceIds,
        includeEtenders: body.includeEtenders === true,
      })
      return NextResponse.json({ success: true, data: result })
    }
    if (body.action === 'run_source' && body.sourceId) {
      const result = await aggregation.runSourceScrape(body.sourceId)
      return NextResponse.json({ success: true, data: result })
    }
    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Action failed' },
      { status: 500 }
    )
  }
}
