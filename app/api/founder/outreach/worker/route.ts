import { NextRequest, NextResponse } from 'next/server'
import { isAutomationAuthorized, automationAuthErrorResponse } from '@/lib/automation/authorizeAutomation'
import {
  isFounderSmeOutreachEnabled,
  OUTREACH_SEND_TICK_SIZE,
  OUTREACH_WORKER_MAX_TICKS,
} from '@/lib/founder/outreach/featureFlag'
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
  let totalSubmitted = 0
  // Bounded ticks — never process the full 2000-recipient ceiling in one invocation
  while (ticks < OUTREACH_WORKER_MAX_TICKS) {
    const result = await processCampaignSends({
      db,
      campaignId,
      maxToProcess: OUTREACH_SEND_TICK_SIZE,
    })
    ticks += 1
    totalSubmitted += result.sent
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

  return NextResponse.json({
    success: true,
    data: {
      ticks,
      /** Provider API acceptances this invocation — not mailbox DELIVERED */
      submitted: totalSubmitted,
      totalSent: totalSubmitted,
    },
  })
}
