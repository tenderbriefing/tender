import { NextRequest, NextResponse } from 'next/server'
import { verifyApiUser, unauthorizedResponse } from '@/lib/auth/verifyApiUser'
import { assertYouthAgentWorkspaceAccess } from '@/lib/agent/workspace/apiGuard'
import { getFirebaseAdmin } from '@/lib/backend/firebaseAdmin'

export const dynamic = 'force-dynamic'

const MAX_BYTES = 10 * 1024 * 1024
const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'audio/mpeg',
  'audio/mp4',
  'audio/webm',
])

/**
 * Secure evidence upload for workspace field reports.
 * Stores under workspace-evidence/{requestId}/{agentId}/…
 */
export async function POST(request: NextRequest) {
  const user = await verifyApiUser(request.headers.get('authorization'), [
    'youth-agent',
    'admin',
  ])
  if (!user) return unauthorizedResponse()
  const denied = assertYouthAgentWorkspaceAccess(user)
  if (denied) return denied

  try {
    const form = await request.formData()
    const file = form.get('file')
    const requestId = String(form.get('requestId') || '')
    if (!requestId || !(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: 'requestId and file required' },
        { status: 400 }
      )
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ success: false, error: 'File exceeds 10MB' }, { status: 413 })
    }
    const contentType = file.type || 'application/octet-stream'
    if (!ALLOWED_TYPES.has(contentType)) {
      return NextResponse.json({ success: false, error: 'Unsupported file type' }, { status: 415 })
    }

    const admin = getFirebaseAdmin()
    const db = admin.firestore()
    const reqSnap = await db.collection('attendanceRequests').doc(requestId).get()
    if (!reqSnap.exists) {
      return NextResponse.json({ success: false, error: 'Assignment not found' }, { status: 404 })
    }
    const req = reqSnap.data()!
    const agentId = user.uid
    if (user.userType === 'youth-agent') {
      const ok =
        req.agentId === agentId ||
        req.assignedAgentId === agentId ||
        (Array.isArray(req.notifiedAgents) && req.notifiedAgents.includes(agentId))
      if (!ok) {
        return NextResponse.json({ success: false, error: 'Not assigned' }, { status: 403 })
      }
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const safeName = String(file.name || 'evidence')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 80)
    const path = `workspace-evidence/${requestId}/${agentId}/${Date.now()}-${safeName}`
    const bucket = admin.storage().bucket()
    const gcsFile = bucket.file(path)
    await gcsFile.save(buffer, {
      metadata: { contentType, metadata: { uploadedBy: agentId, requestId } },
      resumable: false,
    })

    // Signed URL for authenticated consumers (not public bucket)
    const [url] = await gcsFile.getSignedUrl({
      action: 'read',
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    })

    const ws = require('../../../../../backend/services/agentWorkspace/workspaceService')
    await ws.appendAuditEvent({
      type: 'evidence_uploaded',
      actorUid: agentId,
      actorRole: user.userType,
      requestId,
      payload: { path, contentType, size: file.size },
    })

    return NextResponse.json({
      success: true,
      data: { path, url, contentType, size: file.size },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    )
  }
}
