import { NextRequest, NextResponse } from 'next/server'
import { verifyApiUser, unauthorizedResponse } from '@/lib/auth/verifyApiUser'

export const dynamic = 'force-dynamic'

function opsService() {
  return require('../../../../../../backend/services/ops/opsLifecycleService')
}

/** Admin evidence upload — private GCS path, no public ACL. */
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['admin'])
  if (!user) return unauthorizedResponse('Admin sign-in required')
  const params = await props.params

  try {
    const form = await request.formData()
    const file = form.get('file')
    const category = String(form.get('category') || 'other')
    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: 'file is required' },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const ops = opsService()
    const uploaded = await ops.uploadEvidence(
      params.id,
      {
        buffer,
        fileName: file.name,
        contentType: file.type || 'application/octet-stream',
        category,
        size: file.size,
      },
      { uid: user.uid, email: user.email }
    )

    return NextResponse.json({
      success: true,
      data: {
        evidence: uploaded.evidence,
        row: ops.toOpsBoardRow(uploaded.request),
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed'
    const status = /exceeds|Unsupported|Invalid/.test(message)
      ? message.includes('15MB')
        ? 413
        : 415
      : 400
    return NextResponse.json({ success: false, error: message }, { status })
  }
}

/** List evidence metadata for a request (admin only). */
export async function GET(
  _request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const user = await verifyApiUser(_request.headers.get('authorization'), ['admin'])
  if (!user) return unauthorizedResponse('Admin sign-in required')
  const params = await props.params
  try {
    const ops = opsService()
    const doc = await ops.getRequest(params.id)
    if (!doc) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({
      success: true,
      data: {
        evidenceItems: Array.isArray(doc.evidenceItems) ? doc.evidenceItems : [],
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Load failed' },
      { status: 500 }
    )
  }
}
