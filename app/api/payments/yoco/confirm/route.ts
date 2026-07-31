import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/** Yoco confirm retired. */
export async function POST() {
  return NextResponse.json(
    {
      error: {
        code: 'payment_provider_retired',
        message: 'Yoco is retired. Payment confirmation is PayFast ITN only.',
      },
    },
    { status: 410 }
  )
}
