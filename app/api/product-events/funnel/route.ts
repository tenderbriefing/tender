import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, clientIpFromRequest } from '@/lib/security/rateLimit'

export const dynamic = 'force-dynamic'

const ALLOWED = new Set(['tender_listing_viewed', 'tender_opened'])

/**
 * Unauthenticated commercial funnel events (discovery / tender detail).
 * Behavioural only — never payment authority. Rate-limited; allow-listed metadata.
 */
export async function POST(request: NextRequest) {
  const ip = clientIpFromRequest(request)
  const limited = checkRateLimit(`funnel-events:${ip}`, 60, 60_000)
  if (!limited.allowed) {
    return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 })
  }

  let body: {
    eventName?: string
    sessionId?: string
    pagePath?: string
    deviceCategory?: string
    tenderId?: string
    province?: string
    resultCount?: number
    instrumentationVersion?: string
  } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.eventName || !ALLOWED.has(body.eventName)) {
    return NextResponse.json({ success: false, error: 'Event not allowed' }, { status: 400 })
  }

  if (body.eventName === 'tender_opened') {
    const tid = typeof body.tenderId === 'string' ? body.tenderId.trim() : ''
    if (!tid || tid.length > 120) {
      return NextResponse.json({ success: false, error: 'tenderId required' }, { status: 400 })
    }
  }

  try {
    const productEvents = require('../../../../backend/services/productEventService.js')
    const metadata: Record<string, unknown> = {}
    if (typeof body.tenderId === 'string' && body.tenderId.trim()) {
      metadata.tenderId = body.tenderId.trim().slice(0, 120)
    }
    if (typeof body.province === 'string' && body.province.trim()) {
      metadata.province = body.province.trim().slice(0, 80)
    }
    if (Number.isFinite(body.resultCount)) {
      metadata.resultCount = Math.max(0, Math.min(100000, Math.round(Number(body.resultCount))))
    }
    metadata.instrumentationVersion =
      typeof body.instrumentationVersion === 'string' && body.instrumentationVersion.length < 40
        ? body.instrumentationVersion
        : productEvents.FUNNEL_INSTRUMENTATION_VERSION

    const result = await productEvents.ingestProductEvent(
      { uid: 'anonymous_funnel', userType: null },
      {
        eventName: body.eventName,
        sessionId:
          typeof body.sessionId === 'string' ? body.sessionId.slice(0, 80) : null,
        pagePath: typeof body.pagePath === 'string' ? body.pagePath.slice(0, 200) : null,
        feature: 'revenue_funnel',
        deviceCategory:
          typeof body.deviceCategory === 'string' ? body.deviceCategory.slice(0, 40) : null,
        targetEntityType: body.eventName === 'tender_opened' ? 'tender' : 'catalogue',
        targetEntityId:
          body.eventName === 'tender_opened' && typeof body.tenderId === 'string'
            ? body.tenderId.trim().slice(0, 120)
            : null,
        metadata,
      }
    )

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 })
    }
    return NextResponse.json({ success: true, data: result.data })
  } catch (error) {
    console.error('[funnel-events]', error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, error: 'Unavailable' }, { status: 503 })
  }
}
