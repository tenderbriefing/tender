import { NextRequest, NextResponse } from 'next/server'
import { backend } from '@/lib/backend/loadServices'
import { verifyApiUser } from '@/lib/auth/verifyApiUser'
import {
  isPlatformVisibleToViewer,
  isPublicDetailVisibleToViewer,
  toPublicTenderBriefing,
  type PlatformViewer,
} from '@/lib/security/publicTender'
import { verifyPrivateTenderInvite } from '@/lib/security/privateTenderInvite'

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
    let visible = isPlatformVisibleToViewer(tender, viewer, {
      allowOptionalForAdmin: true,
    })

    // Public detail pages include historical compulsory briefings after briefing cut-off.
    if (!visible && !user) {
      visible = isPublicDetailVisibleToViewer(tender, viewer, {
        allowOptionalForAdmin: true,
      })
    }

    // Signed WhatsApp invite: authenticated SMEs may load a private RFQ for booking
    // without it appearing on public /tenders or /sme/book-agent lists.
    if (
      !visible &&
      tender.visibility === 'private' &&
      user?.userType === 'sme'
    ) {
      const invite =
        request.nextUrl.searchParams.get('invite') ||
        request.headers.get('x-private-invite')
      if (verifyPrivateTenderInvite(invite, tender.id)) {
        visible = true
      }
    }

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
