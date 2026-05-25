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
    const leads = await pilotCrm.listLeads({
      leadType: searchParams.get('leadType') || undefined,
      status: searchParams.get('status') || undefined,
      province: searchParams.get('province') || undefined,
      search: searchParams.get('search') || undefined,
    })
    return NextResponse.json({ success: true, data: leads })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to list leads' },
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
    const lead = await pilotCrm.createLead(body, user.uid)
    return NextResponse.json({ success: true, data: lead })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to create lead' },
      { status: 500 }
    )
  }
}
