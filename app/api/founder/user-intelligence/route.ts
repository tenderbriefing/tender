import { NextRequest, NextResponse } from 'next/server'
import { verifyFounderUser } from '@/lib/founder/verifyFounder'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const access = await verifyFounderUser(request.headers.get('authorization'))
    if ('error' in access) return access.error

    const { searchParams } = new URL(request.url)
    const page = Number(searchParams.get('page') || 1)
    const pageSize = Number(searchParams.get('pageSize') || 25)
    const role = searchParams.get('role') || 'all'
    const q = searchParams.get('q') || ''
    const province = searchParams.get('province') || ''

    const svc = require('../../../../backend/services/founderIntelligenceService.js')

    const data = await svc.buildFounderIntelligence({ page, pageSize, role, q, province })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load founder intelligence',
      },
      { status: 500 }
    )
  }
}
