import { NextRequest, NextResponse } from 'next/server'
import { verifyFounderUser } from '@/lib/founder/verifyFounder'

export const dynamic = 'force-dynamic'

type PayoutAction = 'hold' | 'release' | 'mark_paid'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { payoutId: string } }
) {
  try {
    const access = await verifyFounderUser(request.headers.get('authorization'))
    if ('error' in access) return access.error

    const payoutId = params.payoutId
    if (!payoutId) {
      return NextResponse.json({ success: false, error: 'payoutId required' }, { status: 400 })
    }

    const body = await request.json()
    const action = String(body.action || '') as PayoutAction
    const svc = require('../../../../../../backend/services/finance/youthAgentPayoutService.js')

    if (action === 'hold') {
      const payout = await svc.holdPayout(payoutId, {
        actorUid: access.user.uid,
        reason: body.reason || null,
      })
      return NextResponse.json({ success: true, data: payout })
    }

    if (action === 'release') {
      const payout = await svc.releasePayoutHold(payoutId, { actorUid: access.user.uid })
      return NextResponse.json({ success: true, data: payout })
    }

    if (action === 'mark_paid') {
      if (!body.paymentReference) {
        return NextResponse.json(
          { success: false, error: 'paymentReference is required to mark paid' },
          { status: 400 }
        )
      }
      const result = await svc.markPayoutPaid(payoutId, {
        actorUid: access.user.uid,
        paymentReference: String(body.paymentReference),
        paymentMethod: body.paymentMethod ? String(body.paymentMethod) : 'manual',
      })
      return NextResponse.json({ success: true, data: result })
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Payout update failed',
      },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { payoutId: string } }
) {
  try {
    const access = await verifyFounderUser(request.headers.get('authorization'))
    if ('error' in access) return access.error

    const svc = require('../../../../../../backend/services/finance/youthAgentPayoutService.js')
    const payout = await svc.getPayoutById(params.payoutId)
    if (!payout) {
      return NextResponse.json({ success: false, error: 'Payout not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: payout })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load payout',
      },
      { status: 500 }
    )
  }
}
