import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/** FCM token registration retired — Batch C (2026-08). Historical deviceTokens on users are not written. */
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'PUSH_NOTIFICATIONS_RETIRED',
        message: 'Push token registration is retired.',
      },
    },
    { status: 410 }
  )
}
