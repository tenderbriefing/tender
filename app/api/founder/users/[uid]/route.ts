import { NextRequest, NextResponse } from 'next/server'
import { verifyFounderUser } from '@/lib/founder/verifyFounder'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  context: { params: { uid: string } }
) {
  try {
    const access = await verifyFounderUser(request.headers.get('authorization'))
    if ('error' in access) return access.error

    const uid = context.params.uid
    /* eslint-disable @typescript-eslint/no-require-imports */
    const svc = require('../../../../../backend/services/founderIntelligenceService.js')
    /* eslint-enable @typescript-eslint/no-require-imports */

    const data = await svc.getUserDetail(uid)
    if (!data) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load user detail',
      },
      { status: 500 }
    )
  }
}
