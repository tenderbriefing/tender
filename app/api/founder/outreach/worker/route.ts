import { NextRequest, NextResponse } from 'next/server'
import { isAutomationAuthorized, automationAuthErrorResponse } from '@/lib/automation/authorizeAutomation'
import { isFounderSmeOutreachEnabled } from '@/lib/founder/outreach/featureFlag'
import { getFirebaseAdmin } from '@/lib/backend/firebaseAdmin'
import { processCampaignSends } from '@/lib/founder/outreach/sendEngine'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(request: NextRequest) {
  if (!isFounderSmeOutreachEnabled()) {
    return NextResponse.json({ success: false, error: 'disabled' }, { status: 403 })
  }
  if (!isAutomationAuthorized(request)) {
    return NextResponse.json(automationAuthErrorResponse(), { status: 401 })
  }
  let body: { campaignId?: string } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }
  const campaignId = String(body.campaignId || '')
  if (!campaignId) {
    return NextResponse.json({ success: false, error: 'campaignId required' }, { status: 400 })
  }

  const db = getFirebaseAdmin().firestore()
  let ticks = 0
  let totalSent = 0
  // Process up to several ticks within maxDuration budget
  while (ticks < 8) {
    const result = await processCampaignSends({ db, campaignId, maxToProcess: 300 })
    ticks += 1
    totalSent += result.sent
    if (result.processed === 0) break
    const still = await db
      .collection('founderOutreachCampaigns')
      .doc(campaignId)
      .collection('deliveries')
      .where('status', '==', 'queued')
      .limit(1)
      .get()
    if (still.empty) break
  }

  return NextResponse.json({ success: true, data: { ticks, totalSent } })
}
