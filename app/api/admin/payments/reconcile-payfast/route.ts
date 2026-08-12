import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, isGuardResponse } from '@/lib/auth/apiGuards'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Admin-only authoritative PayFast reconciliation.
 * Marks an attendance request paid only after PayFast process/query confirms COMPLETE
 * for the exact pf_payment_id + m_payment_id + amount.
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request)
  if (isGuardResponse(guard)) return guard

  try {
    const body = await request.json().catch(() => ({}))
    const requestId = String(body?.requestId || '').trim()
    const pfPaymentId = String(body?.pfPaymentId || '').trim()
    const reason = String(body?.reason || 'admin_payfast_reconcile').slice(0, 200)

    if (!requestId || !pfPaymentId) {
      return NextResponse.json(
        { success: false, error: 'requestId and pfPaymentId are required' },
        { status: 400 }
      )
    }

    const paymentService = require('../../../../../backend/services/payments/attendancePaymentService')
    const result = await paymentService.reconcileAuthoritativePayfastPayment({
      requestId,
      pfPaymentId,
      reason,
      actorId: `admin:${guard.uid}`,
    })

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.reason || 'Reconciliation failed', data: result },
        { status: 409 }
      )
    }

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Reconciliation failed',
      },
      { status: 500 }
    )
  }
}
