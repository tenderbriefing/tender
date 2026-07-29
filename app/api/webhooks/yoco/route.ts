import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/** Legacy Yoco webhook — disabled after PayFast cutover. */
export async function POST(_request: NextRequest) {
  return NextResponse.json(
    {
      ok: false,
      error: 'Yoco webhooks are retired. Use /api/webhooks/payfast',
      code: 'YOCO_RETIRED',
    },
    { status: 410 }
  )
}
