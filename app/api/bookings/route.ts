import { NextRequest, NextResponse } from 'next/server'
import { ensureRouteAccess, isAccessDenied } from '@/lib/auth/ensureRouteAccess'

/**
 * Legacy connector-booking API.
 * Production bookings use /api/attendance-requests + PayFast.
 * All actions return 410 — kept only so old clients get a clear retirement signal.
 */
function legacyDisabledResponse() {
  return NextResponse.json(
    {
      success: false,
      error:
        'Legacy /api/bookings is disabled. Use attendance requests with PayFast for paid briefing bookings.',
      code: 'LEGACY_BOOKINGS_DISABLED',
    },
    { status: 410 }
  )
}

export async function POST(request: NextRequest) {
  const access = await ensureRouteAccess(request)
  if (isAccessDenied(access)) return access
  return legacyDisabledResponse()
}

export async function GET(request: NextRequest) {
  const access = await ensureRouteAccess(request)
  if (isAccessDenied(access)) return access
  return legacyDisabledResponse()
}
