/**
 * Founder-verified inbox placement records.
 * Never invent placement — only store explicit Founder observations.
 */
import type { Firestore } from 'firebase-admin/firestore'

export const OUTREACH_INBOX_PLACEMENTS = 'founderOutreachInboxPlacements'

export type InboxPlacementLabel =
  | 'primary'
  | 'promotions'
  | 'spam'
  | 'other'
  | 'not_found'
  | 'not_checked'

export type InboxPlacementRecord = {
  id: string
  campaignId: string
  deliveryId: string
  providerMessageId: string | null
  recipientEmail: string
  provider: 'gmail' | 'outlook' | 'yahoo' | 'other'
  placement: InboxPlacementLabel
  notedAt: string
  notedByUid: string
  notedByEmail: string
  notes: string | null
}

export async function recordInboxPlacement(
  db: Firestore,
  input: Omit<InboxPlacementRecord, 'id' | 'notedAt'> & { id?: string }
): Promise<InboxPlacementRecord> {
  const id =
    input.id ||
    `${input.campaignId}_${input.deliveryId}_${input.provider}`.slice(0, 180)
  const row: InboxPlacementRecord = {
    id,
    campaignId: input.campaignId,
    deliveryId: input.deliveryId,
    providerMessageId: input.providerMessageId || null,
    recipientEmail: String(input.recipientEmail || '')
      .trim()
      .toLowerCase(),
    provider: input.provider,
    placement: input.placement,
    notedAt: new Date().toISOString(),
    notedByUid: input.notedByUid,
    notedByEmail: input.notedByEmail,
    notes: input.notes ? String(input.notes).slice(0, 500) : null,
  }
  await db.collection(OUTREACH_INBOX_PLACEMENTS).doc(id).set(row, { merge: true })

  // Mirror onto delivery doc for campaign history (explicit Founder verification only)
  if (row.campaignId && row.deliveryId) {
    await db
      .collection('founderOutreachCampaigns')
      .doc(row.campaignId)
      .collection('deliveries')
      .doc(row.deliveryId)
      .set(
        {
          inboxPlacement: row.placement,
          inboxPlacementProvider: row.provider,
          inboxPlacementNotedAt: row.notedAt,
          updatedAt: row.notedAt,
        },
        { merge: true }
      )
  }
  return row
}

export async function listInboxPlacements(
  db: Firestore,
  limit = 50
): Promise<InboxPlacementRecord[]> {
  const snap = await db
    .collection(OUTREACH_INBOX_PLACEMENTS)
    .orderBy('notedAt', 'desc')
    .limit(Math.min(200, Math.max(1, limit)))
    .get()
  return snap.docs.map((d) => d.data() as InboxPlacementRecord)
}
