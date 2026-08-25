import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, clientIpFromRequest } from '@/lib/security/rateLimit'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const ip = clientIpFromRequest(request)
    const limited = checkRateLimit(`private-tender-status:${ip}`, 30, 60_000)
    if (!limited.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 }
      )
    }

    const token = String(params.token || '').trim()
    if (!token || token.length < 16) {
      return NextResponse.json({ success: false, error: 'Invalid tracking token' }, { status: 400 })
    }

    const svc = require('../../../../../backend/services/privateTenderSubmissionService.js')
    const submission = await svc.getSubmissionByTrackingToken(token)
    if (!submission) {
      return NextResponse.json({ success: false, error: 'Submission not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: svc.toPublicStatus(submission) })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load status',
      },
      { status: 500 }
    )
  }
}
