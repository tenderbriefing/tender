import { NextRequest, NextResponse } from 'next/server'
import { verifyApiUser, unauthorizedResponse, forbiddenResponse } from '@/lib/auth/verifyApiUser'

export const dynamic = 'force-dynamic'

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

    const updated = await emailIngestion.updateStatus(params.id, 'approved', {
      approvedBy: user.uid,
      approvedAt: new Date().toISOString(),
    })
    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Approve failed' },
      { status: 400 }
    )
  }
}
