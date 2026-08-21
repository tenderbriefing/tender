import { NextRequest, NextResponse } from 'next/server'
import { verifyApiUser, unauthorizedResponse, forbiddenResponse } from '@/lib/auth/verifyApiUser'
import { getFirebaseAdmin } from '@/lib/backend/firebaseAdmin'
import type { BriefingIntelligenceReport } from '@/lib/briefing-intelligence/types'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { reportId: string } }
) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['admin', 'youth-agent', 'sme'])
  if (!user) return unauthorizedResponse('Sign-in required')

  const { searchParams } = new URL(request.url)
  const download = searchParams.get('download') === '1' || searchParams.get('download') === 'true'

  const reportId = params.reportId
  const admin = getFirebaseAdmin()
  const db = admin.firestore()
  const reportSnap = await db.collection('briefingIntelligenceReports').doc(reportId).get()
  if (!reportSnap.exists) return NextResponse.json({ success: false, error: 'Report not found' }, { status: 404 })

  const report = reportSnap.data() as BriefingIntelligenceReport
  const canView =
    user.userType === 'admin' ||
    (user.userType === 'youth-agent' && report.agentId === user.uid) ||
    (user.userType === 'sme' && report.smeId === user.uid)
  if (!canView) return forbiddenResponse('Not allowed to download this PDF')

  // Non-admins may only download after founder approval / final delivery states.
  if (user.userType !== 'admin') {
    const genStatus = String((report as any).reportGenerationStatus || '')
    const allowed =
      report.status === 'final' ||
      report.status === 'delivered' ||
      genStatus === 'approved'
    if (!allowed) {
      return NextResponse.json(
        { success: false, error: 'PDF available after report approval' },
        { status: 403 }
      )
    }
  }

  const pdfPath = report.pdfStorageRef || `briefing-intelligence/${reportId}/pdf/${reportId}.pdf`

  try {
    const bucket = admin.storage().bucket()
    const [buffer] = await bucket.file(pdfPath).download()
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': download
          ? `attachment; filename="TenderBriefing-Report-${reportId}.pdf"`
          : `inline; filename="TenderBriefing-Report-${reportId}.pdf"`,
      },
    })
  } catch {
    return NextResponse.json({ success: false, error: 'PDF not available' }, { status: 404 })
  }
}

