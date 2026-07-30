import { NextRequest, NextResponse } from 'next/server'
import { getFirebaseAdmin } from '@/lib/backend/firebaseAdmin'
import { checkRateLimit, clientIpFromRequest } from '@/lib/security/rateLimit'
import { sanitizeAuthErrorCode } from '@/lib/auth/googleAuthFlow'

export const dynamic = 'force-dynamic'

const ALLOWED = new Set(['google_sign_in_started', 'google_sign_in_failed'])

/**
 * Unauthenticated auth-funnel events (started / failed before a session exists).
 * Writes via Admin SDK; rate-limited; never accepts tokens or sensitive payloads.
 */
export async function POST(request: NextRequest) {
  const ip = clientIpFromRequest(request)
  const limited = checkRateLimit(`auth-funnel:${ip}`, 30, 60_000)
  if (!limited.allowed) {
    return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 })
  }

  let body: {
    eventName?: string
    pagePath?: string
    deviceCategory?: string
    registrationJourney?: string
    errorCode?: string
  } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.eventName || !ALLOWED.has(body.eventName)) {
    return NextResponse.json({ success: false, error: 'Event not allowed' }, { status: 400 })
  }

  const journey =
    body.registrationJourney === 'sme' ||
    body.registrationJourney === 'youth-agent' ||
    body.registrationJourney === 'signin'
      ? body.registrationJourney
      : 'signin'

  const metadata: Record<string, string> = {
    authenticationProvider: 'google',
    registrationJourney: journey,
  }
  if (body.eventName === 'google_sign_in_failed') {
    metadata.errorCode = sanitizeAuthErrorCode(body.errorCode)
  }

  try {
    const db = getFirebaseAdmin().firestore()
    const now = new Date().toISOString()
    const eventId = `pe_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    await db.collection('productEvents').doc(eventId).set({
      eventId,
      eventName: body.eventName,
      actorUserId: 'anonymous_auth_funnel',
      actorRole: null,
      timestamp: now,
      day: now.slice(0, 10),
      pagePath: typeof body.pagePath === 'string' ? body.pagePath.slice(0, 200) : null,
      feature: 'auth',
      deviceCategory:
        typeof body.deviceCategory === 'string' ? body.deviceCategory.slice(0, 40) : null,
      meaningful: false,
      metadata,
    })
    return NextResponse.json({ success: true, data: { eventId } })
  } catch (error) {
    console.error(
      '[auth-funnel]',
      error instanceof Error ? error.message : error
    )
    return NextResponse.json({ success: false, error: 'Unavailable' }, { status: 503 })
  }
}
