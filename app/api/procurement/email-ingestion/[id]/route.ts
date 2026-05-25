import { NextRequest, NextResponse } from 'next/server'
import { verifyApiUser, unauthorizedResponse, forbiddenResponse } from '@/lib/auth/verifyApiUser'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await verifyApiUser(request.headers.get('authorization'), ['sme', 'admin'])
  if (!user) return unauthorizedResponse()

  try {
    const emailIngestion = require('../../../../../backend/services/procurement/emailIngestionService')
    const doc = await emailIngestion.getById(params.id)
    if (!doc) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    }
    if (!emailIngestion.canUserAccessEmail(doc, user)) return forbiddenResponse()
    return NextResponse.json({ success: true, data: doc })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Load failed' },
      { status: 500 }
    )
  }
}
