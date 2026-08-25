import { NextRequest, NextResponse } from 'next/server'
import { verifyFounderUser } from '@/lib/founder/verifyFounder'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const access = await verifyFounderUser(request.headers.get('authorization'))
    if ('error' in access) return access.error

    const { searchParams } = new URL(request.url)
    const kind = searchParams.get('kind') || 'tender_document'
    const index = Number(searchParams.get('index') || '0')

    const svc = require('../../../../../../backend/services/privateTenderSubmissionService.js')
    const submission = await svc.getSubmissionById(params.id)
    if (!submission) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    }

    let storagePath: string | null = null
    if (kind === 'supporting') {
      storagePath = submission.supportingDocuments?.[index]?.storagePath || null
    } else {
      storagePath = submission.tenderDocument?.storagePath || null
    }

    if (!storagePath) {
      return NextResponse.json({ success: false, error: 'Document not found' }, { status: 404 })
    }

    const signedUrl = await svc.getSignedDocumentUrl(storagePath)
    if (!signedUrl) {
      return NextResponse.json({ success: false, error: 'Unable to authorise download' }, { status: 503 })
    }

    return NextResponse.json({ success: true, data: { url: signedUrl } })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to authorise document',
      },
      { status: 500 }
    )
  }
}
