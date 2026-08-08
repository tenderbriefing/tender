import { NextRequest, NextResponse } from 'next/server'
import { ensureRouteAccess, isAccessDenied } from '@/lib/auth/ensureRouteAccess'

/**
 * Legacy connector-response API.
 * Production uses attendance requests + agent assignment — not connector matching.
 * All actions return 410 — kept so old clients get a clear retirement signal.
 */
function legacyDisabledResponse() {
  return NextResponse.json(
    {
      success: false,
      error:
        'Legacy /api/connector-response is disabled. Use attendance requests and agent job APIs.',
      code: 'LEGACY_CONNECTOR_RESPONSE_DISABLED',
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
