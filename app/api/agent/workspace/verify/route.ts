import { NextRequest, NextResponse } from 'next/server'
import { verifyApiUser, unauthorizedResponse } from '@/lib/auth/verifyApiUser'

export const dynamic = 'force-dynamic'

/** SME verifies / rejects a locked field report. */
export async function POST(request: NextRequest) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['sme', 'admin'])
  if (!user) return unauthorizedResponse('SME sign-in required')

  try {
    const body = await request.json()
    if (!body.requestId || !body.decision) {
      return NextResponse.json(
        { success: false, error: 'requestId and decision (verify|reject) required' },
        { status: 400 }
      )
    }
    const ws = require('../../../../../../backend/services/agentWorkspace/workspaceService')
    const smeId = user.userType === 'admin' && body.smeId ? body.smeId : user.uid
    if (user.userType === 'admin' && !body.smeId) {
      // Admin can verify as system by using request ownership check bypass via admin path
      const db = require('../../../../../../backend/config/firebaseAdmin').getFirestore()
      const reqSnap = await db.collection('attendanceRequests').doc(body.requestId).get()
      if (!reqSnap.exists) {
        return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
      }
      const data = await ws.verifyFieldReport(
        reqSnap.data().smeId,
        body.requestId,
        body.decision === 'reject' ? 'reject' : 'verify',
        body.notes
      )
      await ws.appendAuditEvent({
        type: 'admin_override',
        actorUid: user.uid,
        actorRole: 'admin',
        requestId: body.requestId,
        payload: { decision: body.decision },
      })
      return NextResponse.json({ success: true, data })
    }

    const data = await ws.verifyFieldReport(
      smeId,
      body.requestId,
      body.decision === 'reject' ? 'reject' : 'verify',
      body.notes
    )
    return NextResponse.json({ success: true, data })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Verify failed'
    const status = msg.includes('Not your') ? 403 : 400
    return NextResponse.json({ success: false, error: msg }, { status })
  }
}
