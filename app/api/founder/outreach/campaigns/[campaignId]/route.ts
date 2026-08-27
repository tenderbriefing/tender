import { NextRequest, NextResponse } from 'next/server'
import { verifyFounderUser } from '@/lib/founder/verifyFounder'
import { isFounderSmeOutreachEnabled } from '@/lib/founder/outreach/featureFlag'
import { getFirebaseAdmin } from '@/lib/backend/firebaseAdmin'
import { getCampaign, listDeliveries } from '@/lib/founder/outreach/campaignStore'

export const dynamic = 'force-dynamic'

type Ctx = { params: { campaignId: string } }

export async function GET(request: NextRequest, context: Ctx) {
  if (!isFounderSmeOutreachEnabled()) {
    return NextResponse.json(
      { success: false, error: 'Founder SME Outreach is disabled', code: 'flag_disabled' },
      { status: 403 }
    )
  }
  const auth = await verifyFounderUser(request.headers.get('authorization'))
  if ('error' in auth) return auth.error

  const campaignId = String(context.params?.campaignId || '')
  const db = getFirebaseAdmin().firestore()
  const campaign = await getCampaign(db, campaignId)
  if (!campaign || campaign.createdByUid !== auth.user.uid) {
    // Hide existence from non-owners
    return NextResponse.json({ success: false, error: 'Campaign not found' }, { status: 404 })
  }

  const failed = await listDeliveries(db, campaignId, { status: 'failed', limit: 50 })
  const url = new URL(request.url)
  const includePreview = url.searchParams.get('preview') === '1'
  const preview = includePreview
    ? await listDeliveries(db, campaignId, { limit: 20 })
    : []

  return NextResponse.json({
    success: true,
    data: {
      campaign,
      failed: failed.map((d) => ({
        name: d.name,
        companyName: d.companyName,
        email: d.email,
        errorCode: d.errorCode,
        errorMessageSafe: d.errorMessageSafe,
      })),
      preview: preview.map((d) => ({
        name: d.name,
        companyName: d.companyName,
        email: d.email,
        status: d.status,
      })),
    },
  })
}
