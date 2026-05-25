import { NextRequest, NextResponse } from 'next/server'
import {
  verifyApiUser,
  unauthorizedResponse,
} from '@/lib/auth/verifyApiUser'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['admin'])
  if (!user) return unauthorizedResponse('Admin sign-in required')

  try {
    const body = await request.json()
    const requestId = body.requestId
    if (!requestId) {
      return NextResponse.json(
        { success: false, error: 'requestId is required' },
        { status: 400 }
      )
    }

    const storage = require('../../../../../backend/services/storageAdapter').getStorage()
    const requests = await storage.getAttendanceRequests()
    const req = requests.find((r: { id: string }) => r.id === requestId)
    if (!req) {
      return NextResponse.json({ success: false, error: 'Request not found' }, { status: 404 })
    }

    const liveDispatch = require('../../../../../backend/services/liveDispatchService')
    const agents = await liveDispatch.findBestAgentsForRequest(req, {
      limit: body.limit || 10,
      radiusKm: body.radiusKm,
      provinceWide: body.provinceWide === true,
    })

    return NextResponse.json({ success: true, data: { requestId, agents } })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Dispatch preview failed',
      },
      { status: 500 }
    )
  }
}
