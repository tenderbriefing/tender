import { NextRequest, NextResponse } from 'next/server'
import { verifyFounderUser } from '@/lib/founder/verifyFounder'
import { isFounderSmeOutreachEnabled } from '@/lib/founder/outreach/featureFlag'
import { getFirebaseAdmin } from '@/lib/backend/firebaseAdmin'
import { computeDeliverabilityMetrics } from '@/lib/founder/outreach/deliverability/metrics'
import { listInboxPlacements, recordInboxPlacement } from '@/lib/founder/outreach/deliverability/inboxPlacement'
import { getOutreachRuntimeConfig } from '@/lib/founder/outreach/deliverability/reputation'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (!isFounderSmeOutreachEnabled()) {
    return NextResponse.json(
      { success: false, error: 'Founder Outreach is disabled', code: 'flag_disabled' },
      { status: 403 }
    )
  }
  const auth = await verifyFounderUser(request.headers.get('authorization'))
  if ('error' in auth) return auth.error

  const db = getFirebaseAdmin().firestore()
  let resendDomainStatus: string | null = null
  try {
    const key = (process.env.RESEND_API_KEY || '').trim()
    if (key) {
      const res = await fetch('https://api.resend.com/domains', {
        headers: { Authorization: `Bearer ${key}` },
      })
      if (res.ok) {
        const json = (await res.json()) as { data?: Array<{ name?: string; status?: string }> }
        const row = (json.data || []).find((d) => d.name === 'tenderbriefing.co.za')
        resendDomainStatus = row?.status || null
      }
    }
  } catch {
    resendDomainStatus = null
  }

  const metrics = await computeDeliverabilityMetrics(db, { resendDomainStatus })
  const placements = await listInboxPlacements(db, 30)
  const runtime = await getOutreachRuntimeConfig(db)

  return NextResponse.json({
    success: true,
    data: {
      metrics,
      placements: placements.map((p) => ({
        id: p.id,
        campaignId: p.campaignId,
        deliveryId: p.deliveryId,
        recipientEmail: p.recipientEmail,
        provider: p.provider,
        placement: p.placement,
        notedAt: p.notedAt,
        notes: p.notes,
      })),
      runtime,
      bulkAuthorized: false,
      sendersLockedTo: 'TenderBriefing <hello@tenderbriefing.co.za>',
    },
  })
}

export async function POST(request: NextRequest) {
  if (!isFounderSmeOutreachEnabled()) {
    return NextResponse.json(
      { success: false, error: 'Founder Outreach is disabled', code: 'flag_disabled' },
      { status: 403 }
    )
  }
  const auth = await verifyFounderUser(request.headers.get('authorization'))
  if ('error' in auth) return auth.error

  let body: {
    action?: string
    campaignId?: string
    deliveryId?: string
    providerMessageId?: string
    recipientEmail?: string
    provider?: 'gmail' | 'outlook' | 'yahoo' | 'other'
    placement?: 'primary' | 'promotions' | 'spam' | 'other' | 'not_found' | 'not_checked'
    notes?: string
  } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  if (body.action !== 'record_inbox_placement') {
    return NextResponse.json(
      { success: false, error: 'Unsupported action', code: 'unsupported_action' },
      { status: 400 }
    )
  }

  if (!body.campaignId || !body.deliveryId || !body.recipientEmail || !body.provider || !body.placement) {
    return NextResponse.json(
      { success: false, error: 'Missing required placement fields', code: 'invalid_input' },
      { status: 400 }
    )
  }

  const db = getFirebaseAdmin().firestore()
  const row = await recordInboxPlacement(db, {
    campaignId: body.campaignId,
    deliveryId: body.deliveryId,
    providerMessageId: body.providerMessageId || null,
    recipientEmail: body.recipientEmail,
    provider: body.provider,
    placement: body.placement,
    notedByUid: auth.user.uid,
    notedByEmail: auth.user.email || '',
    notes: body.notes || null,
  })

  return NextResponse.json({ success: true, data: { placement: row } })
}
