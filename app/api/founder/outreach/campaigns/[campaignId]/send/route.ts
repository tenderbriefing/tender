import { NextRequest, NextResponse } from 'next/server'
import { verifyFounderUser } from '@/lib/founder/verifyFounder'
import { isFounderSmeOutreachEnabled } from '@/lib/founder/outreach/featureFlag'
import { getFirebaseAdmin } from '@/lib/backend/firebaseAdmin'
import { getCampaign } from '@/lib/founder/outreach/campaignStore'
import { confirmAndStartCampaign, processCampaignSends } from '@/lib/founder/outreach/sendEngine'
import { checkRateLimit } from '@/lib/security/rateLimit'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

type Ctx = { params: { campaignId: string } }

export async function POST(request: NextRequest, context: Ctx) {
  if (!isFounderSmeOutreachEnabled()) {
    return NextResponse.json(
      { success: false, error: 'Founder SME Outreach is disabled', code: 'flag_disabled' },
      { status: 403 }
    )
  }

  const auth = await verifyFounderUser(request.headers.get('authorization'))
  if ('error' in auth) return auth.error

  const campaignId = String(context.params?.campaignId || '')
  if (!campaignId) {
    return NextResponse.json({ success: false, error: 'campaignId required' }, { status: 400 })
  }

  let body: { confirmCount?: number; authorisedList?: boolean; confirmSend?: boolean } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.confirmSend || !body.authorisedList) {
    return NextResponse.json(
      {
        success: false,
        error: 'Explicit confirmation required (confirmSend and authorisedList).',
        code: 'confirmation_required',
      },
      { status: 400 }
    )
  }

  const rl = checkRateLimit(`founder-outreach-send:${auth.user.uid}:${campaignId}`, 3, 60_000)
  if (!rl.allowed) {
    return NextResponse.json({ success: false, error: 'Send rate limited' }, { status: 429 })
  }

  const db = getFirebaseAdmin().firestore()
  try {
    const existing = await getCampaign(db, campaignId)
    if (!existing || existing.createdByUid !== auth.user.uid) {
      return NextResponse.json({ success: false, error: 'Campaign not found' }, { status: 404 })
    }
    if (typeof body.confirmCount === 'number' && body.confirmCount !== existing.sendableRows) {
      return NextResponse.json(
        {
          success: false,
          error: `Confirmation count mismatch. Expected ${existing.sendableRows}.`,
          code: 'count_mismatch',
        },
        { status: 400 }
      )
    }

    await confirmAndStartCampaign({
      db,
      campaignId,
      founderUid: auth.user.uid,
    })

    // Process sends on this request (bounded). Idempotent if retried.
    const result = await processCampaignSends({ db, campaignId, maxToProcess: 400 })

    // If more queued remain, fire-and-forget continue via worker
    const still = await db
      .collection('founderOutreachCampaigns')
      .doc(campaignId)
      .collection('deliveries')
      .where('status', '==', 'queued')
      .limit(1)
      .get()
    if (!still.empty) {
      void enqueueOutreachWorker(campaignId)
    }

    return NextResponse.json({
      success: true,
      data: {
        campaignId,
        status: 'sending',
        processedThisTick: result.processed,
        sentThisTick: result.sent,
        failedThisTick: result.failed,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Send failed'
    const status = /not found/i.test(message) ? 404 : /denied|cannot/i.test(message) ? 409 : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
}

async function enqueueOutreachWorker(campaignId: string) {
  try {
    const base =
      process.env.APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      'https://www.tenderbriefing.co.za'
    const secret = (process.env.SYNC_SECRET || process.env.AUTOMATION_SECRET || '').trim()
    await fetch(`${base.replace(/\/$/, '')}/api/founder/outreach/worker`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(secret ? { 'x-sync-secret': secret } : {}),
      },
      body: JSON.stringify({ campaignId }),
    })
  } catch {
    /* fail-soft — Founder can reopen / poll */
  }
}
