import { NextRequest, NextResponse } from 'next/server'
import { verifyApiUser, unauthorizedResponse } from '@/lib/auth/verifyApiUser'

export const dynamic = 'force-dynamic'

function opsService() {
  return require('../../../../../../../backend/services/ops/opsLifecycleService')
}

/** Admin-only signed download URL. SMEs must never reach this route. */
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string; evidenceId: string }> }
) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['admin'])
  if (!user) return unauthorizedResponse('Admin sign-in required')
  const params = await props.params
  try {
    const ops = opsService()
    const data = await ops.getEvidenceSignedUrl(params.id, params.evidenceId, {
      uid: user.uid,
      email: user.email,
    })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Access failed' },
      { status: 404 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ id: string; evidenceId: string }> }
) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['admin'])
  if (!user) return unauthorizedResponse('Admin sign-in required')
  const params = await props.params
  try {
    const ops = opsService()
    const saved = await ops.removeEvidence(params.id, params.evidenceId, {
      uid: user.uid,
      email: user.email,
    })
    return NextResponse.json({
      success: true,
      data: { row: ops.toOpsBoardRow(saved) },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Delete failed' },
      { status: 400 }
    )
  }
}
