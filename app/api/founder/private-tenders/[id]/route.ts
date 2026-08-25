import { NextRequest, NextResponse } from 'next/server'
import { verifyFounderUser } from '@/lib/founder/verifyFounder'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const access = await verifyFounderUser(request.headers.get('authorization'))
    if ('error' in access) return access.error

    const svc = require('../../../../../backend/services/privateTenderSubmissionService.js')
    const submission = await svc.getSubmissionById(params.id)
    if (!submission) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: submission })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load submission',
      },
      { status: 500 }
    )
  }
}
