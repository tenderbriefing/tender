import { NextRequest, NextResponse } from 'next/server'
import { backend } from '@/lib/backend/loadServices'
import {
  verifyApiUser,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/lib/auth/verifyApiUser'

export const dynamic = 'force-dynamic'

type InvoiceRequest = {
  id: string
  smeId?: string
  paymentStatus?: string
  invoiceNumber?: string | null
  paymentToken?: string | null
  [key: string]: unknown
}

/**
 * Owner/admin invoice PDF download — regenerates from canonical request (idempotent number).
 */
export async function GET(
  _request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params
  try {
    const user = await verifyApiUser(_request.headers.get('authorization'))
    if (!user) return unauthorizedResponse()

    const agentService = backend.agentAssignment()
    const req = (await agentService.getRequestById(params.id)) as InvoiceRequest | null
    if (!req) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    }

    const canView = user.userType === 'admin' || req.smeId === user.uid
    if (!canView) return forbiddenResponse()

    if (!req.invoiceNumber && req.paymentStatus === 'not_required') {
      return NextResponse.json(
        { success: false, error: 'No invoice for this booking' },
        { status: 404 }
      )
    }

    const { ensureInvoiceOnRequest } = require('../../../../../backend/services/payments/invoiceNumber')
    const { request: withInvoice, minted } = ensureInvoiceOnRequest(req)
    if (minted) {
      const storage = require('../../../../../backend/services/storageAdapter').getStorage()
      await storage.saveAttendanceRequest(withInvoice)
    }

    const manualPdf = require('../../../../../backend/services/payments/manualInvoicePdf')
    const origin =
      process.env.NEXT_PUBLIC_SITE_URL || 'https://www.tenderbriefing.co.za'
    const paymentUrl = withInvoice.paymentToken
      ? `${origin}/pay/${withInvoice.paymentToken}`
      : `${origin}/sme/requests/${encodeURIComponent(withInvoice.id)}`
    const pdf = await manualPdf.renderManualInvoicePdf(withInvoice, { paymentUrl })
    const filename = `${withInvoice.invoiceNumber || withInvoice.id}.pdf`

    return new NextResponse(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Invoice PDF failed',
      },
      { status: 500 }
    )
  }
}
