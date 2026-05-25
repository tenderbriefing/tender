import { NextRequest, NextResponse } from 'next/server'
import { backend } from '@/lib/backend/loadServices'
import { verifyApiUser, unauthorizedResponse, forbiddenResponse } from '@/lib/auth/verifyApiUser'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const storage = backend.getStorage()
    const tender = await storage.getTenderBriefingById(params.id)

    if (!tender) {
      return NextResponse.json(
        { success: false, error: 'Tender briefing not found' },
        { status: 404 }
      )
    }

    if (tender.visibility === 'private') {
      const user = await verifyApiUser(request.headers.get('authorization'))
      if (!user) return unauthorizedResponse()
      const allowed =
        user.userType === 'admin' ||
        (user.userType === 'sme' && tender.ownerUid === user.uid)
      if (!allowed) return forbiddenResponse('Private RFQ not accessible')
    }

    return NextResponse.json({ success: true, data: tender })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load tender',
      },
      { status: 500 }
    )
  }
}
