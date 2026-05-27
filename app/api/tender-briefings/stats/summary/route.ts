import { NextRequest, NextResponse } from 'next/server'

import { verifyApiUser } from '@/lib/auth/verifyApiUser'
import { buildPublicProcurementStats } from '@/lib/seo/publicStats'
import { toPublicTenderStats } from '@/lib/security/publicTender'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const stats = await buildPublicProcurementStats()
    const user = await verifyApiUser(request.headers.get('authorization'))

    if (user?.userType === 'admin') {
      return NextResponse.json({ success: true, data: stats })
    }

    return NextResponse.json({ success: true, data: toPublicTenderStats(stats) })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load stats',
      },
      { status: 500 }
    )
  }
}
