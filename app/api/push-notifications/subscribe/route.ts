import { NextRequest, NextResponse } from 'next/server'
import { ensureRouteAccess, isAccessDenied } from '@/lib/auth/ensureRouteAccess'

/**
 * Topic subscribe was a fake-success stub. Fail closed until Admin SDK subscribe is wired.
 */
export async function POST(request: NextRequest) {
  const access = await ensureRouteAccess(request)
  if (isAccessDenied(access)) return access

  return NextResponse.json(
    {
      success: false,
      error: 'Push topic subscribe is not implemented.',
      code: 'PUSH_SUBSCRIBE_NOT_IMPLEMENTED',
    },
    { status: 501 }
  )
}
