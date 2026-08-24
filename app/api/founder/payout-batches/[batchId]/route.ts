import { NextRequest, NextResponse } from 'next/server'
import { verifyFounderUser } from '@/lib/founder/verifyFounder'

export const dynamic = 'force-dynamic'

type BatchAction = 'mark_paid'

export async function GET(
  request: NextRequest,
  { params }: { params: { batchId: string } }
) {
  try {
    const access = await verifyFounderUser(request.headers.get('authorization'))
    if ('error' in access) return access.error

    const svc = require('../../../../../../backend/services/finance/youthAgentPayoutBatchService.js')
    const data = await svc.getBatchWithPayouts(params.batchId)
    if (!data) {
      return NextResponse.json({ success: false, error: 'Batch not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load batch',
      },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { batchId: string } }
) {
  try {
    const access = await verifyFounderUser(request.headers.get('authorization'))
    if ('error' in access) return access.error

    const body = await request.json()
    const action = String(body.action || '') as BatchAction
    const svc = require('../../../../../../backend/services/finance/youthAgentPayoutBatchService.js')

    if (action === 'mark_paid') {
      if (!body.paymentReference) {
        return NextResponse.json(
          { success: false, error: 'paymentReference is required to mark batch paid' },
          { status: 400 }
        )
      }
      const result = await svc.markBatchPaid(params.batchId, {
        actorUid: access.user.uid,
        paymentReference: String(body.paymentReference),
        paymentMethod: body.paymentMethod ? String(body.paymentMethod) : 'EFT',
      })
      return NextResponse.json({ success: true, data: result })
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Batch update failed',
      },
      { status: 500 }
    )
  }
}
