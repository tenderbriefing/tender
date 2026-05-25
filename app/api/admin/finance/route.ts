import { NextRequest, NextResponse } from 'next/server'
import { verifyApiUser, unauthorizedResponse } from '@/lib/auth/verifyApiUser'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['admin'])
  if (!user) return unauthorizedResponse('Admin sign-in required')
  try {
    const aiOps = require('../../../../backend/services/aiOpsExecutiveService')
    const payoutService = require('../../../../backend/services/finance/payoutService')
    const invoiceService = require('../../../../backend/services/finance/invoiceService')
    const ext = await aiOps.getAiOpsExtension()
    const [payouts, invoices] = await Promise.all([
      payoutService.listPayouts(30),
      invoiceService.listInvoices(20),
    ])
    return NextResponse.json({
      success: true,
      data: { ...ext.finance, payouts, invoices },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Finance load failed' },
      { status: 500 }
    )
  }
}
