import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Authorised document retrieval for published tenders (including private-sector).
 * Private submission files remain in non-public GCS; this issues a short-lived signed URL.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string; docId: string } }
) {
  try {
    const backend = require('../../../../../backend/services/storageAdapter')
    const storage = backend.getStorage()
    const tender = await storage.getTenderById(params.id)
    if (!tender || tender.visibility === 'private') {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    }

    const docs = Array.isArray(tender.documents) ? tender.documents : []
    const doc = docs.find((d: { id?: string }) => d.id === params.docId) as
      | { id?: string; url?: string; title?: string }
      | undefined

    // External public URLs (eTenders) — redirect
    if (doc?.url && /^https?:\/\//i.test(doc.url)) {
      return NextResponse.redirect(doc.url)
    }

    if (tender.sourceType !== 'private' && !tender.privateSubmissionId) {
      if (doc?.url) return NextResponse.redirect(doc.url)
      return NextResponse.json({ success: false, error: 'Document not available' }, { status: 404 })
    }

    const svc = require('../../../../../backend/services/privateTenderSubmissionService.js')
    const submission = tender.privateSubmissionId
      ? await svc.getSubmissionById(tender.privateSubmissionId)
      : null
    if (!submission) {
      return NextResponse.json({ success: false, error: 'Document not available' }, { status: 404 })
    }

    let storagePath: string | null = null
    if (params.docId === 'tender-document') {
      storagePath = submission.tenderDocument?.storagePath || null
    } else if (params.docId.startsWith('supporting-')) {
      const index = Number(params.docId.replace('supporting-', '')) - 1
      storagePath = submission.supportingDocuments?.[index]?.storagePath || null
    }

    if (!storagePath) {
      return NextResponse.json({ success: false, error: 'Document not found' }, { status: 404 })
    }

    const signedUrl = await svc.getSignedDocumentUrl(storagePath)
    if (!signedUrl) {
      return NextResponse.json(
        { success: false, error: 'Unable to authorise download' },
        { status: 503 }
      )
    }

    return NextResponse.redirect(signedUrl)
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Document retrieval failed',
      },
      { status: 500 }
    )
  }
}
