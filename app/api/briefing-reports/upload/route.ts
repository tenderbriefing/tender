import { NextRequest, NextResponse } from 'next/server'
import { backend } from '@/lib/backend/loadServices'
import {
  verifyApiUser,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/lib/auth/verifyApiUser'

export const dynamic = 'force-dynamic'

const MAX_BYTES = 10 * 1024 * 1024
const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
])

export async function POST(request: NextRequest) {
  try {
    const user = await verifyApiUser(request.headers.get('authorization'), ['youth-agent'])
    if (!user) return unauthorizedResponse('Youth Agent sign-in required')

    const formData = await request.formData()
    const requestId = String(formData.get('requestId') || '')
    const file = formData.get('file')

    if (!requestId) {
      return NextResponse.json({ success: false, error: 'requestId is required' }, { status: 400 })
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: 'file is required' }, { status: 400 })
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { success: false, error: 'File exceeds 10MB limit' },
        { status: 400 }
      )
    }

    const contentType = file.type || 'application/octet-stream'
    if (!ALLOWED_TYPES.has(contentType)) {
      return NextResponse.json(
        { success: false, error: 'Only images and PDF files are allowed' },
        { status: 400 }
      )
    }

    const agentService = backend.agentAssignment()
    const attendance = await agentService.getRequestById(requestId)
    if (!attendance) {
      return NextResponse.json({ success: false, error: 'Request not found' }, { status: 404 })
    }

    if (attendance.assignedAgentId !== user.uid && attendance.agentId !== user.uid) {
      return forbiddenResponse('You are not assigned to this briefing')
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    /* eslint-disable @typescript-eslint/no-require-imports */
    const storageService = require('../../../../backend/services/integrations/firebaseStorageService.js')
    /* eslint-enable @typescript-eslint/no-require-imports */

    const upload = await storageService.uploadBriefingProof({
      requestId,
      fileName: file.name,
      buffer,
      contentType,
    })

    if (!upload.ok) {
      return NextResponse.json(
        {
          success: false,
          error: upload.error || upload.reason || 'Upload failed',
          skipped: upload.skipped === true,
        },
        { status: upload.skipped ? 503 : 400 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        url: upload.url,
        path: upload.path,
        contentType,
        fileName: file.name,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      },
      { status: 500 }
    )
  }
}
