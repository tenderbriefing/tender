import type { Firestore } from 'firebase-admin/firestore'
import { OUTREACH_SEND_CONCURRENCY, OUTREACH_SEND_TICK_SIZE } from './featureFlag'
import {
  OUTREACH_CAMPAIGNS,
  type OutreachCampaign,
  type OutreachDelivery,
} from './types'
import { listIdForCampaignType, renderOutreachEmail } from './templateRegistry'
import { templateVersionForCampaignType, type OutreachCampaignType } from './campaignTypes'
import { renderComposerEmail } from './renderComposerEmail'
import {
  sendFounderOutreachEmail,
  isRetryableOutreachError,
} from '@/lib/services/founderOutreachEmail'
import { indexOutreachProviderMessage } from '@/lib/founder/outreach/deliverability/webhookReconcile'

function resolveCampaignType(campaign: OutreachCampaign): OutreachCampaignType {
  if (campaign.type === 'youth_agent_invitation') return 'youth_agent_invitation'
  if (campaign.type === 'blank_email') return 'blank_email'
  if (campaign.type === 'composer_custom') return 'composer_custom'
  return 'sme_invitation'
}

function renderDeliveryEmail(campaign: OutreachCampaign, delivery: OutreachDelivery) {
  const campaignType = resolveCampaignType(campaign)
  const hasComposerBody =
    campaign.source === 'composer' ||
    Boolean(campaign.composerHtml && String(campaign.composerHtml).trim())

  if (hasComposerBody) {
    const rendered = renderComposerEmail({
      subject: campaign.subject || 'Message from TenderBriefing',
      bodyHtml: campaign.composerHtml || '',
      recipientEmail: delivery.normalisedEmail,
    })
    return {
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      unsubscribeUrl: rendered.unsubscribeUrl,
      templateVersion: templateVersionForCampaignType(campaignType),
    }
  }

  const rendered = renderOutreachEmail(campaignType, {
    name: delivery.name,
    companyName: delivery.companyName,
    email: delivery.normalisedEmail,
  })
  return {
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    unsubscribeUrl: rendered.unsubscribeUrl,
    templateVersion: templateVersionForCampaignType(campaignType),
  }
}

function nowIso() {
  return new Date().toISOString()
}

async function mapPool<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = []
  let i = 0
  async function worker() {
    while (i < items.length) {
      const idx = i++
      results[idx] = await fn(items[idx])
    }
  }
  const n = Math.min(concurrency, Math.max(1, items.length))
  await Promise.all(Array.from({ length: n }, () => worker()))
  return results
}

/**
 * Process queued deliveries for a campaign. Idempotent — skips already-sent.
 */
/**
 * Process a bounded tick of queued deliveries.
 * Idempotent across worker restarts:
 * - status === 'sent' is never resent (transaction claim rejects)
 * - only 'queued' rows are claimed
 * - stale 'sending' rows (>15m) return to 'queued' for resume
 * Internal status 'sent' means provider ACCEPTED/SUBMITTED — not mailbox DELIVERED.
 */
export async function processCampaignSends(params: {
  db: Firestore
  campaignId: string
  maxToProcess?: number
}): Promise<{ processed: number; sent: number; failed: number }> {
  const { db, campaignId } = params
  const maxToProcess = Math.min(
    Math.max(1, params.maxToProcess ?? OUTREACH_SEND_TICK_SIZE),
    OUTREACH_SEND_TICK_SIZE
  )
  const campRef = db.collection(OUTREACH_CAMPAIGNS).doc(campaignId)
  const campSnap = await campRef.get()
  if (!campSnap.exists) throw new Error('Campaign not found')
  const campaign = campSnap.data() as OutreachCampaign

  if (campaign.status === 'completed' || campaign.status === 'completed_with_failures') {
    return { processed: 0, sent: 0, failed: 0 }
  }

  // Reclaim stale "sending" rows (interrupted Cloud Run / crash) older than 15 minutes.
  const staleCutoff = Date.now() - 15 * 60 * 1000
  const sendingSnap = await campRef
    .collection('deliveries')
    .where('status', '==', 'sending')
    .limit(50)
    .get()
  for (const doc of sendingSnap.docs) {
    const data = doc.data() as OutreachDelivery
    const updated = Date.parse(String(data.updatedAt || ''))
    if (Number.isFinite(updated) && updated < staleCutoff) {
      await doc.ref.set({ status: 'queued', updatedAt: nowIso() }, { merge: true })
    }
  }

  const queuedSnap = await campRef
    .collection('deliveries')
    .where('status', '==', 'queued')
    .limit(maxToProcess)
    .get()

  const deliveries = queuedSnap.docs.map((d) => d.data() as OutreachDelivery)
  if (deliveries.length === 0) {
    // Mark complete if nothing queued left
    const stillQueued = await campRef.collection('deliveries').where('status', '==', 'queued').limit(1).get()
    const failedSnap = await campRef.collection('deliveries').where('status', '==', 'failed').limit(1).get()
    const status =
      !stillQueued.empty
        ? 'sending'
        : !failedSnap.empty
          ? 'completed_with_failures'
          : 'completed'
    await campRef.set(
      {
        status,
        completedAt: status.startsWith('completed') ? nowIso() : null,
        updatedAt: nowIso(),
      },
      { merge: true }
    )
    return { processed: 0, sent: 0, failed: 0 }
  }

  let sent = 0
  let failed = 0

  await mapPool(deliveries, OUTREACH_SEND_CONCURRENCY, async (delivery) => {
    const ref = campRef.collection('deliveries').doc(delivery.id)
    // Claim sending
    const claimed = await db.runTransaction(async (tx) => {
      const fresh = await tx.get(ref)
      if (!fresh.exists) return false
      const data = fresh.data() as OutreachDelivery
      // Never re-send a provider-accepted delivery after worker restart
      if (data.status === 'sent') return false
      if (data.status !== 'queued') return false
      tx.set(
        ref,
        {
          status: 'sending',
          attemptCount: (data.attemptCount || 0) + 1,
          updatedAt: nowIso(),
        },
        { merge: true }
      )
      return true
    })
    if (!claimed) return

    const campaignType = resolveCampaignType(campaign)
    const rendered = renderDeliveryEmail(campaign, delivery)

    const headers: Record<string, string> = {
      'X-Entity-Ref-ID': `${campaignId}:${delivery.normalisedEmail}`,
      'List-ID': listIdForCampaignType(campaignType),
      // Privacy: never attach other campaign recipients to this message
      'X-TenderBriefing-Recipient-Field': String(delivery.recipientField || 'to'),
    }
    if (rendered.unsubscribeUrl) {
      headers['List-Unsubscribe'] = `<${rendered.unsubscribeUrl}>`
      headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click'
    }

    let lastResult: { sent: boolean; id?: string | null; errorCode?: string | null; error?: string } = {
      sent: false,
    }
    const maxAttempts = 3
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // One recipient per Resend message — To/Cc/Bcc role is bookkeeping only;
      // the Resend `to` array always contains exactly this recipient (privacy).
      // Durable provider idempotency: delivery.id is stable across worker restarts,
      // so accept-before-persist crashes cannot create a second mailbox delivery.
      lastResult = await sendFounderOutreachEmail({
        to: delivery.normalisedEmail,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        headers,
        idempotencyKey: `outreach-delivery:${delivery.id}`.slice(0, 256),
      })
      if (lastResult.sent) break
      if (!isRetryableOutreachError(lastResult.errorCode)) break
      await new Promise((r) => setTimeout(r, Math.min(8000, 500 * Math.pow(2, attempt))))
    }

    if (lastResult.sent) {
      sent += 1
      await ref.set(
        {
          status: 'sent',
          /** Resend API acceptance — UI label SUBMITTED; not mailbox Primary */
          providerAcceptance: 'accepted',
          providerLifecycle: 'accepted',
          resendMessageId: lastResult.id || null,
          errorCode: null,
          errorMessageSafe: null,
          sentAt: nowIso(),
          updatedAt: nowIso(),
          templateVersion: rendered.templateVersion,
        },
        { merge: true }
      )
      if (lastResult.id) {
        await indexOutreachProviderMessage(db, {
          providerMessageId: lastResult.id,
          campaignId,
          deliveryId: delivery.id,
          normalisedEmail: delivery.normalisedEmail,
        })
      }
      console.info(
        JSON.stringify({
          event: 'founder_outreach_recipient_sent',
          campaignId,
          deliveryId: delivery.id,
        })
      )
    } else {
      failed += 1
      await ref.set(
        {
          status: 'failed',
          errorCode: lastResult.errorCode || 'unknown',
          errorMessageSafe: String(lastResult.error || 'Send failed').slice(0, 200),
          updatedAt: nowIso(),
        },
        { merge: true }
      )
      console.info(
        JSON.stringify({
          event: 'founder_outreach_recipient_failed',
          campaignId,
          deliveryId: delivery.id,
          errorCode: lastResult.errorCode || 'unknown',
        })
      )
    }
  })

  // Reconcile counters from statuses (accurate)
  await reconcileCampaignCounts(db, campaignId)
  return { processed: deliveries.length, sent, failed }
}

export async function reconcileCampaignCounts(db: Firestore, campaignId: string): Promise<void> {
  const campRef = db.collection(OUTREACH_CAMPAIGNS).doc(campaignId)
  const all = await campRef.collection('deliveries').select('status').get()
  let queued = 0
  let sent = 0
  let failed = 0
  let skipped = 0
  for (const d of all.docs) {
    const s = d.data().status
    if (s === 'queued' || s === 'sending') queued += 1
    else if (s === 'sent') sent += 1
    else if (s === 'failed') failed += 1
    else skipped += 1
  }
  const status =
    queued > 0
      ? 'sending'
      : failed > 0
        ? 'completed_with_failures'
        : 'completed'
  await campRef.set(
    {
      queuedCount: queued,
      sentCount: sent,
      failedCount: failed,
      skippedCount: skipped,
      status,
      completedAt: queued > 0 ? null : nowIso(),
      updatedAt: nowIso(),
    },
    { merge: true }
  )
  if (queued === 0) {
    console.info(
      JSON.stringify({
        event: 'founder_outreach_campaign_completed',
        campaignId,
        sentCount: sent,
        failedCount: failed,
        status,
      })
    )
  }
}

export async function confirmAndStartCampaign(params: {
  db: Firestore
  campaignId: string
  founderUid: string
}): Promise<OutreachCampaign> {
  const ref = params.db.collection(OUTREACH_CAMPAIGNS).doc(params.campaignId)
  const snap = await ref.get()
  if (!snap.exists) throw new Error('Campaign not found')
  const campaign = snap.data() as OutreachCampaign
  if (campaign.createdByUid !== params.founderUid) throw new Error('Campaign access denied')
  if (campaign.status === 'sending' || campaign.status === 'completed' || campaign.status === 'completed_with_failures') {
    return campaign // idempotent confirm
  }
  if (campaign.status !== 'validated') {
    throw new Error(`Campaign cannot be sent from status ${campaign.status}`)
  }
  if (!campaign.sendableRows) throw new Error('No sendable recipients')

  const now = nowIso()
  await ref.set(
    {
      status: 'sending',
      confirmedAt: now,
      startedAt: now,
      updatedAt: now,
    },
    { merge: true }
  )
  console.info(
    JSON.stringify({
      event: 'founder_outreach_campaign_confirmed',
      campaignId: params.campaignId,
      sendableRows: campaign.sendableRows,
    })
  )
  console.info(
    JSON.stringify({
      event: 'founder_outreach_campaign_started',
      campaignId: params.campaignId,
    })
  )
  return { ...campaign, status: 'sending', confirmedAt: now, startedAt: now }
}
