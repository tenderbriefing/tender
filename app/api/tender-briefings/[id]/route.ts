import { NextRequest, NextResponse } from 'next/server'
import { backend } from '@/lib/backend/loadServices'
import { verifyApiUser } from '@/lib/auth/verifyApiUser'
import {
  isPlatformVisibleToViewer,
  toPublicTenderBriefing,
  type PlatformViewer,
} from '@/lib/security/publicTender'

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

    const user = await verifyApiUser(request.headers.get('authorization'))
    const viewer: PlatformViewer = user
      ? { userType: user.userType, uid: user.uid }
      : null

    // Admins may always view tender records (for ops/dispatch).
    const visible = isPlatformVisibleToViewer(tender, viewer, {
      allowOptionalForAdmin: true,
    })

    if (!visible) {
      return NextResponse.json(
        {
          success: false,
          error:
            tender.visibility === 'private'
              ? 'Private RFQ not accessible'
              : 'Tender briefing not found',
        },
        { status: tender.visibility === 'private' ? 403 : 404 }
      )
    }

    const data = user ? tender : toPublicTenderBriefing(tender)
    return NextResponse.json({ success: true, data })
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
