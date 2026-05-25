import { NextRequest, NextResponse } from 'next/server'
import {
  verifyApiUser,
  unauthorizedResponse,
} from '@/lib/auth/verifyApiUser'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: { reportId: string } }
) {
  const user = await verifyApiUser(_request.headers.get('authorization'))
  if (!user) return unauthorizedResponse('Sign-in required')

  try {
    const reportId = params.reportId
    const storage = require('../../../../../../backend/services/storageAdapter').getStorage()
    const reports = await storage.getBriefingReports()
    const report = reports.find((r: { id: string }) => r.id === reportId)
    if (!report) {
      return NextResponse.json({ success: false, error: 'Report not found' }, { status: 404 })
    }

    const requests = await storage.getAttendanceRequests()
    const req = requests.find((r: { id: string }) => r.id === report.requestId)

    const pdfService = require('../../../../../../backend/services/briefingReportPdfService')
    const buffer = pdfService.generatePdfBufferForReport(report, req || {})

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
