import { NextRequest, NextResponse } from 'next/server'
import {
  verifyApiUser,
  unauthorizedResponse,
} from '@/lib/auth/verifyApiUser'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['admin'])
  if (!user) return unauthorizedResponse('Admin sign-in required')

  try {
    const pilotCrm = require('../../../../../../backend/services/pilotCrmService')
    const body = await request.json()
    const task = await pilotCrm.updateTask(params.id, body, user.uid)
    return NextResponse.json({ success: true, data: task })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update task' },
      { status: 500 }
    )
  }
}
