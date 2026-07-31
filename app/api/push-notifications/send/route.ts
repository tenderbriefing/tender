import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, isGuardResponse } from '@/lib/auth/apiGuards'

/**
 * Push send is not production-ready (previously used a placeholder FCM token).
 * Return 501 until a real token lookup + send path is implemented.
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request)
  if (isGuardResponse(guard)) return guard

  return NextResponse.json(
    {
      success: false,
      error: 'Push notification send is not implemented. FCM token lookup required.',
      code: 'PUSH_SEND_NOT_IMPLEMENTED',
    },
    { status: 501 }
  )
}
