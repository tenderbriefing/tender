import { NextRequest, NextResponse } from 'next/server'
import { verifyApiUser, unauthorizedResponse } from '@/lib/auth/verifyApiUser'

export const dynamic = 'force-dynamic'

function reportService() {
  return require('../../../../../../../backend/services/ops/reportProductionService')
}

/** Admin-only PDF/DOCX download (signed URL or buffer). SMEs: 401. */
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['admin'])
  if (!user) return unauthorizedResponse('Admin sign-in required')
  const params = await props.params
  const format = request.nextUrl.searchParams.get('format') || 'pdf'
  const versionId = request.nextUrl.searchParams.get('versionId') || undefined

  try {
    const reports = reportService()
    const file = await reports.getSignedDownload(
      params.id,
      format,
      {
        uid: user.uid,
        email: user.email,
      },
      { versionId }
    )

    if (file.mode === 'buffer') {
      return new NextResponse(new Uint8Array(file.buffer), {
        status: 200,
        headers: {
          'Content-Type': file.contentType,
          'Content-Disposition': `attachment; filename="${file.fileName || 'report'}"`,
          'Cache-Control': 'private, no-store',
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        url: file.url,
        fileName: file.fileName,
        contentType: file.contentType,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Download failed',
      },
      { status: 404 }
    )
  }
}
