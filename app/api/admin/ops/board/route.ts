import { NextRequest, NextResponse } from 'next/server'
import { verifyApiUser, unauthorizedResponse } from '@/lib/auth/verifyApiUser'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['admin'])
  if (!user) return unauthorizedResponse('Admin sign-in required')

  try {
    const limit = Number(request.nextUrl.searchParams.get('limit') || 150)
    const filter = String(request.nextUrl.searchParams.get('filter') || '')
    const ops = require('../../../../../backend/services/ops/opsLifecycleService')
    const rows = await ops.listOpsBoard({ limit, filter })
    const exceptions = filter
      ? rows.filter((r: { exceptionCode?: string | null }) => r.exceptionCode)
      : await ops.listExceptionQueue({ limit: 80 })
    return NextResponse.json({
      success: true,
      data: { rows, exceptions },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load ops board',
      },
      { status: 500 }
    )
  }
}
