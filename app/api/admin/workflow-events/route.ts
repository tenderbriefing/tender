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
    const limit = Math.min(Number(request.nextUrl.searchParams.get('limit') || 50), 100)
    const workflow = require('../../../../backend/services/workflowAutomationService')
    const telemetry = await workflow.getWorkflowTelemetry({ limit })
    return NextResponse.json({ success: true, data: telemetry })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load workflow events',
      },
      { status: 500 }
    )
  }
}
