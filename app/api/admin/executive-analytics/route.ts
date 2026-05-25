import { NextRequest, NextResponse } from 'next/server'
import {
  verifyApiUser,
  unauthorizedResponse,
} from '@/lib/auth/verifyApiUser'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['admin'])
  if (!user) return unauthorizedResponse('Admin sign-in required')

  try {
    const executive = require('../../../../backend/services/executiveAnalyticsService')
    const snapshot = request.nextUrl.searchParams.get('snapshot') === '1'
    const data = snapshot
      ? await executive.saveExecutiveMetricsSnapshot()
      : await executive.getLatestExecutiveMetrics()
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Executive analytics failed',
      },
      { status: 500 }
    )
  }
}
