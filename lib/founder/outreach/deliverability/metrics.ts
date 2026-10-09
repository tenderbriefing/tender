/**
 * Aggregate deliverability metrics for Founder dashboard.
 * Distinguishes provider delivery from Founder-verified inbox placement.
 */
import type { Firestore } from 'firebase-admin/firestore'
import { OUTREACH_CAMPAIGNS } from '../types'
import { OUTREACH_INBOX_PLACEMENTS } from './inboxPlacement'
import { buildStaticAuthAudit } from './authAudit'
import { getOutreachRuntimeConfig } from './reputation'
import { fromAddress } from '@/lib/services/founderOutreachEmail'

export type DeliverabilityMetrics = {
  generatedAt: string
  windowCampaignLimit: number
  campaignsScanned: number
  submitted: number
  providerDelivered: number
  bounced: number
  complained: number
  failed: number
  suppressedRecipientsNoted: number
  providerDeliveryRate: number | null
  bounceRate: number | null
  complaintRate: number | null
  founderVerifiedInbox: {
    primary: number
    promotions: number
    spam: number
    other: number
    not_found: number
    not_checked: number
    total: number
  }
  disclaimer: string
  runtime: Awaited<ReturnType<typeof getOutreachRuntimeConfig>>
  auth: ReturnType<typeof buildStaticAuthAudit>
}

export async function computeDeliverabilityMetrics(
  db: Firestore,
  opts?: { campaignLimit?: number; resendDomainStatus?: string | null }
): Promise<DeliverabilityMetrics> {
  const limit = Math.min(50, Math.max(1, opts?.campaignLimit ?? 25))
  const camps = await db
    .collection(OUTREACH_CAMPAIGNS)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get()

  let submitted = 0
  let providerDelivered = 0
  let bounced = 0
  let complained = 0
  let failed = 0
  let suppressedRecipientsNoted = 0

  for (const c of camps.docs) {
    const camp = c.data()
    suppressedRecipientsNoted += Number(camp.suppressedRows || 0)
    const dels = await c.ref.collection('deliveries').select('status', 'providerLifecycle').get()
    for (const d of dels.docs) {
      const row = d.data()
      const status = String(row.status || '')
      const life = String(row.providerLifecycle || '')
      if (status === 'sent' || life) submitted += 1
      if (life === 'delivered') providerDelivered += 1
      if (life === 'bounced') bounced += 1
      if (life === 'complained') complained += 1
      if (life === 'failed' || status === 'failed') failed += 1
    }
  }

  let placementDocs: Array<{ placement?: string }> = []
  try {
    const placements = await db
      .collection(OUTREACH_INBOX_PLACEMENTS)
      .orderBy('notedAt', 'desc')
      .limit(200)
      .get()
    placementDocs = placements.docs.map((d) => d.data() as { placement?: string })
  } catch {
    placementDocs = []
  }

  const founderVerifiedInbox = {
    primary: 0,
    promotions: 0,
    spam: 0,
    other: 0,
    not_found: 0,
    not_checked: 0,
    total: 0,
  }
  for (const p of placementDocs) {
    const place = String(p.placement || 'not_checked')
    if (place === 'primary') founderVerifiedInbox.primary += 1
    else if (place === 'promotions') founderVerifiedInbox.promotions += 1
    else if (place === 'spam') founderVerifiedInbox.spam += 1
    else if (place === 'other') founderVerifiedInbox.other += 1
    else if (place === 'not_found') founderVerifiedInbox.not_found += 1
    else founderVerifiedInbox.not_checked += 1
    founderVerifiedInbox.total += 1
  }

  const denom = submitted > 0 ? submitted : null
  const runtime = await getOutreachRuntimeConfig(db)
  const auth = buildStaticAuthAudit({
    resendDomainStatus: opts?.resendDomainStatus,
    fromAddress: fromAddress(),
  })

  return {
    generatedAt: new Date().toISOString(),
    windowCampaignLimit: limit,
    campaignsScanned: camps.size,
    submitted,
    providerDelivered,
    bounced,
    complained,
    failed,
    suppressedRecipientsNoted,
    providerDeliveryRate: denom ? providerDelivered / denom : null,
    bounceRate: denom ? bounced / denom : null,
    complaintRate: denom ? complained / denom : null,
    founderVerifiedInbox,
    disclaimer:
      'PROVIDER_DELIVERED is Resend mailbox-infrastructure acceptance. It is not Gmail/Outlook Primary Inbox placement. Inbox placement counts only include Founder-verified observations.',
    runtime,
    auth,
  }
}
