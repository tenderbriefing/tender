import { NextRequest, NextResponse } from 'next/server'
import { verifyApiUser, unauthorizedResponse, forbiddenResponse } from '@/lib/auth/verifyApiUser'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['sme', 'admin'])
  if (!user) return unauthorizedResponse()

  try {
    const emailIngestion = require('../../../../../../backend/services/procurement/emailIngestionService')
    const doc = await emailIngestion.getById(params.id)
    if (!doc) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    if (!emailIngestion.canUserAccessEmail(doc, user)) return forbiddenResponse()

    if (doc.status !== 'approved' && user.userType !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Approve the extracted opportunity before converting' },
        { status: 400 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const result = await emailIngestion.convertToPrivateOpportunity(params.id, {
      ownerUid: body.ownerUid || doc.forwardedByUid || user.uid,
      approvedBy: user.uid,
    })

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Convert failed' },
      { status: 400 }
    )
  }
}
