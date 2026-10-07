import { NextRequest, NextResponse } from 'next/server'
import { verifyFounderUser } from '@/lib/founder/verifyFounder'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * Founder-only operational email delivery observability.
 * No SME/YA personal data; Founder recipient + delivery status only.
 */
export async function GET(request: NextRequest) {
  try {
    const access = await verifyFounderUser(request.headers.get('authorization'))
    if ('error' in access) return access.error

    const { searchParams } = new URL(request.url)
    const limit = Number(searchParams.get('limit') || 25)

    const delivery = require('../../../../backend/services/founderOpsEmailDeliveryService')
    const data = await delivery.getFounderEmailDeliveryObservability({ limit })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load email delivery',
      },
      { status: 500 }
    )
  }
}
