import { NextRequest, NextResponse } from 'next/server'
import {
  verifyApiUser,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/lib/auth/verifyApiUser'
import {
  enforceDistributedPolicy,
  tooManyRequests,
} from '@/lib/security/distributedRateLimit'
import { logEvent, newRequestId } from '@/lib/observability/logger'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: { reportId: string } }
) {
  const requestId = newRequestId()
  const user = await verifyApiUser(_request.headers.get('authorization'))
  if (!user) return unauthorizedResponse('Sign-in required')

  const limited = await enforceDistributedPolicy('pdf-download', user.uid)
  if (!limited.allowed) return tooManyRequests(limited.retryAfterSec)

  try {
    const reportId = params.reportId
    const storage = require('../../../../../backend/services/storageAdapter').getStorage()
    const reports = await storage.getBriefingReports()
    const report = reports.find((r: { id: string }) => r.id === reportId)
    if (!report) {
      return NextResponse.json({ success: false, error: 'Report not found' }, { status: 404 })
    }

    const requests = await storage.getAttendanceRequests()
    const req = requests.find((r: { id: string }) => r.id === report.requestId)

    const canView =
      user.userType === 'admin' ||
      (req &&
        (req.smeId === user.uid ||
          req.assignedAgentId === user.uid ||
          req.agentId === user.uid))

    if (!canView) {
      logEvent({
        event: 'cross_user_access_denial',
        severity: 'warn',
        requestId,
        userId: user.uid,
        role: user.userType,
        outcome: 'denied',
        errorCode: 'pdf_forbidden',
      })
      return forbiddenResponse()
    }

    const pdfService = require('../../../../../backend/services/briefingReportPdfService')
    const buffer = pdfService.generatePdfBufferForReport(report, req || {})

    logEvent({
      event: 'briefing_pdf_downloaded',
      requestId,
      userId: user.uid,
      role: user.userType,
      outcome: 'success',
    })

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="briefing-${reportId}.pdf"`,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'PDF generation failed',
      },
      { status: 500 }
    )
  }
}
