import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/** Push notifications retired — Batch C (2026-08). Use in-app, email, or WhatsApp. */
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'PUSH_NOTIFICATIONS_RETIRED',
        message: 'Push notifications are retired. Use in-app notifications, email, or WhatsApp.',
      },
    },
    { status: 410 }
  )
}
