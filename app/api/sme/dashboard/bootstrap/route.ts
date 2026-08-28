import { NextRequest, NextResponse } from 'next/server'
import { verifyApiUser, unauthorizedResponse } from '@/lib/auth/verifyApiUser'
import { loadSmeDashboardBootstrap } from '@/lib/sme/loadSmeDashboardBootstrap'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await verifyApiUser(request.headers.get('authorization'))
    if (!user) return unauthorizedResponse()
    if (user.userType !== 'sme') {
      return NextResponse.json({ success: false, error: 'SME access required' }, { status: 403 })
    }

    const data = await loadSmeDashboardBootstrap(user)

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load dashboard bootstrap',
      },
      { status: 500 }
    )
  }
}
