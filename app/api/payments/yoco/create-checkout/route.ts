import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/** Yoco checkout retired — use PayFast `/api/payments/payfast/create-checkout`. */
export async function POST() {
  return NextResponse.json(
    {
      error: {
        code: 'payment_provider_retired',
        message: 'Yoco is retired. Use PayFast create-checkout.',
      },
    },
    { status: 410 }
  )
}
