import { NextRequest, NextResponse } from 'next/server'
import { ensureRouteAccess, isAccessDenied } from '@/lib/auth/ensureRouteAccess'

/**
 * Legacy connector matching API.
 * Production dispatch uses attendance + liveDispatch — not mock tender matching.
 * All actions return 410 — kept so old clients get a clear retirement signal.
 */
function legacyDisabledResponse() {
  return NextResponse.json(
    {
      success: false,
      error:
        'Legacy /api/matching is disabled. Use attendance requests and live dispatch.',
      code: 'LEGACY_MATCHING_DISABLED',
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
