import { NextRequest, NextResponse } from 'next/server'
import { verifyApiUser, unauthorizedResponse } from '@/lib/auth/verifyApiUser'
import { validateUploadFile } from '@/lib/security/uploadValidation'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['youth-agent', 'admin'])
  if (!user) return unauthorizedResponse('Agent sign-in required')
  try {
    const formData = await request.formData()
    const requestId = String(formData.get('requestId') || '')
    const mediaType = String(formData.get('mediaType') || 'photo')
    const file = formData.get('file')
    if (!requestId || !(file instanceof File)) {
      return NextResponse.json({ success: false, error: 'requestId and file required' }, { status: 400 })
    }
    const uploadError = validateUploadFile(file)
    if (uploadError) {
      return NextResponse.json({ success: false, error: uploadError }, { status: 400 })
    }
    const buffer = Buffer.from(await file.arrayBuffer())
    const storageService = require('../../../../../backend/services/integrations/firebaseStorageService.js')
    const folder = mediaType === 'voice' ? 'voice-notes' : 'field-media'
    const upload = await storageService.uploadBriefingProof({
      requestId: `${requestId}/${folder}`,
      fileName: file.name || `${mediaType}-${Date.now()}`,
      buffer,
      contentType: file.type || 'application/octet-stream',
    })
    if (!upload.ok) {
      return NextResponse.json(
        { success: false, error: upload.reason || upload.error || 'Upload skipped', skipped: upload.skipped },
        { status: upload.skipped ? 503 : 400 }
      )
    }
    const field = require('../../../../../backend/services/mobile/mobileFieldService')
    await field.recordTelemetry(user.uid, 'media_upload', { requestId, mediaType, path: upload.path })
    return NextResponse.json({ success: true, data: upload })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    )
  }
}
