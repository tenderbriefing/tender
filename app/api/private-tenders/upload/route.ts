import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, clientIpFromRequest } from '@/lib/security/rateLimit'
import {
  isAllowedTenderDocument,
  MAX_TENDER_DOCUMENT_BYTES,
  mimeFromFileName,
} from '@/lib/privateTenders/constants'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const ip = clientIpFromRequest(request)
    const limited = checkRateLimit(`private-tender-upload:${ip}`, 20, 60 * 60 * 1000)
    if (!limited.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many uploads — please try again later' },
        {
          status: 429,
          headers: limited.retryAfterSec
            ? { 'Retry-After': String(limited.retryAfterSec) }
            : undefined,
        }
      )
    }

    const body = await request.json()
    const fileName = String(body.fileName || '').trim()
    const contentType =
      String(body.contentType || mimeFromFileName(fileName) || '').trim() ||
      'application/octet-stream'
    const kind = body.kind === 'supporting' ? 'supporting' : 'tender_document'
    const base64 = String(body.file || body.data || '')
    if (!fileName || !base64) {
      return NextResponse.json(
        { success: false, error: 'fileName and file data are required' },
        { status: 400 }
      )
    }
    if (!isAllowedTenderDocument(fileName, contentType)) {
      return NextResponse.json(
        { success: false, error: 'Only PDF, DOC, or DOCX files are allowed' },
        { status: 400 }
      )
    }

    const cleaned = base64.replace(/^data:[^;]+;base64,/, '')
    let buffer: Buffer
    try {
      buffer = Buffer.from(cleaned, 'base64')
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid file encoding' }, { status: 400 })
    }

    if (!buffer.length || buffer.length > MAX_TENDER_DOCUMENT_BYTES) {
      return NextResponse.json(
        {
          success: false,
          error: `File must be between 1 byte and ${Math.floor(MAX_TENDER_DOCUMENT_BYTES / (1024 * 1024))} MB`,
        },
        { status: 400 }
      )
    }

    const svc = require('../../../../backend/services/privateTenderSubmissionService.js')
    const meta = await svc.uploadPrivateTenderDocument({
      buffer,
      fileName,
      contentType,
      kind,
      submissionDraftId: body.draftId || undefined,
    })

    return NextResponse.json({ success: true, data: meta })
  } catch (error) {
    const status = (error as { status?: number })?.status || 500
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      },
      { status }
    )
  }
}
