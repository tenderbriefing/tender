import { NextRequest, NextResponse } from 'next/server'
import { verifyFounderUser } from '@/lib/founder/verifyFounder'
import { isFounderSmeOutreachEnabled } from '@/lib/founder/outreach/featureFlag'
import { getFirebaseAdmin } from '@/lib/backend/firebaseAdmin'
import { listCampaigns } from '@/lib/founder/outreach/campaignStore'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (!isFounderSmeOutreachEnabled()) {
    return NextResponse.json(
      { success: false, error: 'Founder SME Outreach is disabled', code: 'flag_disabled' },
      { status: 403 }
    )
  }
  const auth = await verifyFounderUser(request.headers.get('authorization'))
  if ('error' in auth) return auth.error

  const db = getFirebaseAdmin().firestore()
  const all = await listCampaigns(db, 40)
  const mine = all.filter((c) => c.createdByUid === auth.user.uid)
  return NextResponse.json({
    success: true,
    data: {
      campaigns: mine.map((c) => ({
        id: c.id,
        originalFileName: c.originalFileName,
        createdAt: c.createdAt,
        status: c.status,
        sendableRows: c.sendableRows,
        sentCount: c.sentCount,
        failedCount: c.failedCount,
        suppressedRows: c.suppressedRows,
      })),
    },
  })
}
