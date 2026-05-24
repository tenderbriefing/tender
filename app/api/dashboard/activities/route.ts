import { NextRequest, NextResponse } from 'next/server'
import {
  verifyApiUser,
  unauthorizedResponse,
} from '@/lib/auth/verifyApiUser'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await verifyApiUser(request.headers.get('authorization'))
    if (!user) return unauthorizedResponse()

    const { getActivitiesForUser } = require('../../../../backend/services/dashboardActivitiesService')
    const data = await getActivitiesForUser(user)

    return NextResponse.json(
      { success: true, data },
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('[GET /api/dashboard/activities]', error)
    return NextResponse.json(
      {
        success: true,
        data: [],
        error:
          error instanceof Error ? error.message : 'Failed to load activities',
      },
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}
