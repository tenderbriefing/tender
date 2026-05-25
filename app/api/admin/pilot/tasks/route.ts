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
    const pilotCrm = require('../../../../../backend/services/pilotCrmService')
    const { searchParams } = new URL(request.url)
    const tasks = await pilotCrm.listTasks({
      status: searchParams.get('status') || undefined,
    })
    return NextResponse.json({ success: true, data: tasks })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to list tasks' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['admin'])
  if (!user) return unauthorizedResponse('Admin sign-in required')

  try {
    const pilotCrm = require('../../../../../backend/services/pilotCrmService')
    const body = await request.json()
    const task = await pilotCrm.createTask(body, user.uid)
    return NextResponse.json({ success: true, data: task })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to create task' },
      { status: 500 }
    )
  }
}
