import { NextRequest, NextResponse } from 'next/server'
import { verifyFounderUser } from '@/lib/founder/verifyFounder'
import { verifyApiUser, unauthorizedResponse } from '@/lib/auth/verifyApiUser'
import { checkRateLimit, clientIpFromRequest } from '@/lib/security/rateLimit'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const ip = clientIpFromRequest(request)
    const limited = checkRateLimit(`product-events:${ip}`, 60, 60_000)
    if (!limited.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many events — please try again shortly' },
        {
          status: 429,
          headers: limited.retryAfterSec
            ? { 'Retry-After': String(limited.retryAfterSec) }
            : undefined,
        }
      )
    }

    const user = await verifyApiUser(request.headers.get('authorization'), [
      'sme',
      'youth-agent',
      'admin',
    ])
    if (!user) return unauthorizedResponse()

    const body = await request.json()
    const productEvents = require('../../../backend/services/productEventService.js')

    // Actor identity always from verified token — never from client body
    const result = await productEvents.ingestProductEvent(
      { uid: user.uid, userType: user.userType, province: user.province },
      {
        eventName: body.eventName,
        sessionId: typeof body.sessionId === 'string' ? body.sessionId.slice(0, 80) : undefined,
        pagePath: typeof body.pagePath === 'string' ? body.pagePath.slice(0, 300) : undefined,
        feature: typeof body.feature === 'string' ? body.feature.slice(0, 80) : undefined,
        targetUserId:
          typeof body.targetUserId === 'string' ? body.targetUserId.slice(0, 128) : undefined,
        targetEntityType:
          typeof body.targetEntityType === 'string'
            ? body.targetEntityType.slice(0, 64)
            : undefined,
        targetEntityId:
          typeof body.targetEntityId === 'string' ? body.targetEntityId.slice(0, 128) : undefined,
        province: typeof body.province === 'string' ? body.province.slice(0, 64) : undefined,
        deviceCategory:
          typeof body.deviceCategory === 'string' ? body.deviceCategory.slice(0, 32) : undefined,
        referralSource:
          typeof body.referralSource === 'string' ? body.referralSource.slice(0, 120) : undefined,
        metadata: body.metadata,
      }
    )

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 })
    }
    return NextResponse.json({ success: true, data: result.data })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to ingest event',
      },
      { status: 500 }
    )
  }
}

/** Founder-only: list events for a user timeline */
export async function GET(request: NextRequest) {
  const access = await verifyFounderUser(request.headers.get('authorization'))
  if ('error' in access) return access.error

  const uid = new URL(request.url).searchParams.get('uid')
  if (!uid) {
    return NextResponse.json({ success: false, error: 'uid required' }, { status: 400 })
  }

  const productEvents = require('../../../backend/services/productEventService.js')
  const events = await productEvents.listEventsForUser(uid, { limit: 50 })
  return NextResponse.json({ success: true, data: events })
}
