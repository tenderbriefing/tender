import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/** Push topic subscribe retired — Batch C (2026-08). */
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'PUSH_NOTIFICATIONS_RETIRED',
        message: 'Push notifications are retired.',
      },
    },
    { status: 410 }
  )
}
