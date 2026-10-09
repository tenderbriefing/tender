/**
 * Reconcile Resend lifecycle webhooks onto Outreach delivery documents.
 *
 * Provider "delivered" updates providerLifecycle only — UI must never claim
 * mailbox Primary placement from this signal alone.
 */
import type { Firestore } from 'firebase-admin/firestore'
import { OUTREACH_CAMPAIGNS } from '../types'
import { upsertEmailSuppression } from '../suppression'
import { setOutreachPaused, shouldPauseForRates } from './reputation'

export const OUTREACH_PROVIDER_INDEX = 'founderOutreachByProviderId'

export type OutreachProviderLifecycle =
  | 'accepted'
  | 'sent'
  | 'delayed'
  | 'delivered'
  | 'bounced'
  | 'complained'
  | 'failed'

const LIFECYCLE_RANK: Record<OutreachProviderLifecycle, number> = {
  accepted: 10,
  sent: 20,
  delayed: 25,
  delivered: 40,
  bounced: 50,
  failed: 50,
  complained: 55,
}

const RESEND_EVENT_TO_LIFECYCLE: Record<string, OutreachProviderLifecycle> = {
  'email.sent': 'sent',
  'email.delivered': 'delivered',
  'email.delivery_delayed': 'delayed',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
  'email.failed': 'failed',
}

function nowIso() {
  return new Date().toISOString()
}

function canAdvance(
  from: OutreachProviderLifecycle | null | undefined,
  to: OutreachProviderLifecycle
): boolean {
  if (!from) return true
  const a = LIFECYCLE_RANK[from] || 0
  const b = LIFECYCLE_RANK[to] || 0
  if (b > a) return true
  // Allow equal only for idempotent duplicate of same terminal? No — skip equals.
  return false
}

export async function indexOutreachProviderMessage(
  db: Firestore,
  input: {
    providerMessageId: string
    campaignId: string
    deliveryId: string
    normalisedEmail: string
  }
): Promise<void> {
  const id = String(input.providerMessageId || '').trim()
  if (!id) return
  await db
    .collection(OUTREACH_PROVIDER_INDEX)
    .doc(id)
    .set(
      {
        providerMessageId: id,
        campaignId: input.campaignId,
        deliveryId: input.deliveryId,
        normalisedEmail: input.normalisedEmail,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      },
      { merge: true }
    )
}

export async function applyOutreachResendEvent(
  db: Firestore,
  input: {
    providerMessageId: string | null | undefined
    eventType: string | null | undefined
    providerEventId?: string | null
    occurredAt?: string | null
  }
): Promise<{
  ok: boolean
  applied: boolean
  reason?: string
  campaignId?: string
  deliveryId?: string
  lifecycle?: OutreachProviderLifecycle
}> {
  const providerMessageId = String(input.providerMessageId || '').trim()
  const eventType = String(input.eventType || '').trim()
  if (!providerMessageId) return { ok: true, applied: false, reason: 'missing_email_id' }

  const lifecycle = RESEND_EVENT_TO_LIFECYCLE[eventType]
  if (!lifecycle) return { ok: true, applied: false, reason: 'unsupported_event' }

  const idx = await db.collection(OUTREACH_PROVIDER_INDEX).doc(providerMessageId).get()
  if (!idx.exists) {
    return { ok: true, applied: false, reason: 'not_outreach_message' }
  }

  const meta = idx.data() || {}
  const campaignId = String(meta.campaignId || '')
  const deliveryId = String(meta.deliveryId || '')
  if (!campaignId || !deliveryId) {
    return { ok: true, applied: false, reason: 'corrupt_index' }
  }

  const ref = db
    .collection(OUTREACH_CAMPAIGNS)
    .doc(campaignId)
    .collection('deliveries')
    .doc(deliveryId)

  const applied = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists) return false
    const row = snap.data() || {}
    const current = (row.providerLifecycle || null) as OutreachProviderLifecycle | null
    if (!canAdvance(current, lifecycle)) {
      // Idempotent duplicate / out-of-order older event
      tx.set(
        ref,
        {
          lastProviderEventId: input.providerEventId || row.lastProviderEventId || null,
          lastProviderEventType: eventType,
          updatedAt: nowIso(),
        },
        { merge: true }
      )
      return false
    }

    const patch: Record<string, unknown> = {
      providerLifecycle: lifecycle,
      lastProviderEventId: input.providerEventId || null,
      lastProviderEventType: eventType,
      lastProviderEventAt: input.occurredAt || nowIso(),
      updatedAt: nowIso(),
    }
    if (lifecycle === 'delivered') {
      patch.providerDeliveredAt = input.occurredAt || nowIso()
      // Explicit: not mailbox placement
      patch.inboxPlacement = row.inboxPlacement || null
    }
    if (lifecycle === 'bounced') {
      patch.providerBouncedAt = input.occurredAt || nowIso()
      patch.errorCode = row.errorCode || 'provider_bounced'
    }
    if (lifecycle === 'complained') {
      patch.providerComplainedAt = input.occurredAt || nowIso()
      patch.errorCode = row.errorCode || 'provider_complained'
    }
    if (lifecycle === 'failed') {
      patch.errorCode = row.errorCode || 'provider_failed'
    }

    tx.set(ref, patch, { merge: true })
    return true
  })

  // Side effects outside transaction
  if (lifecycle === 'bounced' || lifecycle === 'complained') {
    const email = String(meta.normalisedEmail || '')
    if (email) {
      await upsertEmailSuppression(
        db,
        email,
        lifecycle === 'complained' ? 'complaint' : 'hard_bounce',
        `resend_webhook:${eventType}`
      )
    }
    await maybeAutoPause(db)
  }

  return {
    ok: true,
    applied,
    campaignId,
    deliveryId,
    lifecycle,
    reason: applied ? 'updated' : 'noop_or_out_of_order',
  }
}

async function maybeAutoPause(db: Firestore): Promise<void> {
  // Sample recent deliveries with providerLifecycle set (best-effort, bounded)
  const snap = await db
    .collectionGroup('deliveries')
    .orderBy('updatedAt', 'desc')
    .limit(100)
    .get()
    .catch(() => null)
  if (!snap) return

  let sample = 0
  let bounced = 0
  let complained = 0
  for (const d of snap.docs) {
    const life = String(d.data().providerLifecycle || '')
    if (!life) continue
    sample += 1
    if (life === 'bounced' || life === 'failed') bounced += 1
    if (life === 'complained') complained += 1
  }
  const decision = shouldPauseForRates({ sampleSize: sample, bounced, complained })
  if (decision.pause) {
    await setOutreachPaused(db, true, decision.reason)
  }
}

export function mapLifecycleToUiLabel(lifecycle: string | null | undefined): string {
  switch (String(lifecycle || '').toLowerCase()) {
    case 'delivered':
      return 'PROVIDER_DELIVERED'
    case 'bounced':
      return 'BOUNCED'
    case 'complained':
      return 'COMPLAINED'
    case 'failed':
      return 'FAILED'
    case 'delayed':
      return 'DELAYED'
    case 'sent':
      return 'PROVIDER_SENT'
    case 'accepted':
      return 'SUBMITTED'
    default:
      return 'SUBMITTED'
  }
}
