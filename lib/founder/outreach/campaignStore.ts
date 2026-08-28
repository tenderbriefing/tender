import { randomBytes } from 'crypto'
import type { Firestore } from 'firebase-admin/firestore'
import { OUTREACH_TEMPLATE_VERSION } from './featureFlag'
import { listSuppressedAmong } from './suppression'
import type { ParsedOutreachRow, OutreachCampaign, OutreachDelivery } from './types'
import { OUTREACH_CAMPAIGNS } from './types'

function nowIso() {
  return new Date().toISOString()
}

function deliveryIdFor(
  campaignId: string,
  normalisedEmail: string,
  rowNumber: number,
  status: OutreachDelivery['status']
): string {
  // Canonical sendable rows are keyed by email for idempotency.
  if (status === 'queued' && normalisedEmail) {
    const safe = normalisedEmail.replace(/[^a-z0-9@._+-]/gi, '_').slice(0, 120)
    return `${campaignId}_${safe}`.slice(0, 700)
  }
  return `${campaignId}_row_${rowNumber}_${status}`.slice(0, 700)
}

export function newCampaignId(): string {
  return `foc-${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`
}

export async function createValidatedCampaign(params: {
  db: Firestore
  fileName: string
  rows: ParsedOutreachRow[]
  createdByUid: string
  createdByEmail: string
}): Promise<{ campaign: OutreachCampaign; preview: ParsedOutreachRow[] }> {
  const { db, fileName, rows, createdByUid, createdByEmail } = params
  const readyEmails = rows.filter((r) => r.status === 'ready').map((r) => r.normalisedEmail)
  const suppressed = await listSuppressedAmong(db, readyEmails)

  let suppressedRows = 0
  const adjusted: ParsedOutreachRow[] = rows.map((r) => {
    if (r.status === 'ready' && suppressed.has(r.normalisedEmail)) {
      suppressedRows += 1
      return { ...r, status: 'suppressed' as const, reason: 'suppressed' }
    }
    return r
  })

  const sendable = adjusted.filter((r) => r.status === 'ready')
  if (sendable.length === 0) {
    throw new Error('No sendable recipients after suppression filtering.')
  }
  const campaignId = newCampaignId()
  const idempotencyKey = `outreach:${campaignId}`
  const createdAt = nowIso()

  const campaign: OutreachCampaign = {
    id: campaignId,
    type: 'sme_invitation',
    templateVersion: OUTREACH_TEMPLATE_VERSION,
    originalFileName: String(fileName || 'upload.xlsx').slice(0, 200),
    totalRows: adjusted.length,
    validRows: adjusted.filter((r) => r.status === 'ready' || r.status === 'suppressed').length,
    invalidRows: adjusted.filter((r) => r.status === 'invalid').length,
    duplicateRows: adjusted.filter((r) => r.status === 'duplicate').length,
    suppressedRows,
    sendableRows: sendable.length,
    queuedCount: sendable.length,
    sentCount: 0,
    failedCount: 0,
    skippedCount: suppressedRows + adjusted.filter((r) => r.status === 'duplicate' || r.status === 'invalid').length,
    status: 'validated',
    createdByUid,
    createdByEmail,
    createdAt,
    confirmedAt: null,
    startedAt: null,
    completedAt: null,
    lastErrorCode: null,
    idempotencyKey,
  }

  await db.collection(OUTREACH_CAMPAIGNS).doc(campaignId).set(campaign)

  console.info(
    JSON.stringify({
      event: 'founder_outreach_campaign_created',
      campaignId,
      totalRows: campaign.totalRows,
      sendableRows: campaign.sendableRows,
      suppressedRows: campaign.suppressedRows,
      duplicateRows: campaign.duplicateRows,
      invalidRows: campaign.invalidRows,
    })
  )

  // Batch write deliveries (max 400 per batch to stay under 500)
  const deliveries: OutreachDelivery[] = adjusted.map((r) => {
    const status: OutreachDelivery['status'] =
      r.status === 'ready'
        ? 'queued'
        : r.status === 'suppressed'
          ? 'suppressed'
          : r.status === 'duplicate'
            ? 'duplicate'
            : 'invalid'
    return {
      id: deliveryIdFor(campaignId, r.normalisedEmail || `row-${r.rowNumber}`, r.rowNumber, status),
      campaignId,
      name: r.name,
      companyName: r.companyName,
      email: r.email,
      normalisedEmail: r.normalisedEmail,
      status,
      templateVersion: OUTREACH_TEMPLATE_VERSION,
      resendMessageId: null,
      attemptCount: 0,
      errorCode: r.reason || null,
      errorMessageSafe: r.reason || null,
      createdAt,
      updatedAt: createdAt,
      sentAt: null,
    }
  })

  for (let i = 0; i < deliveries.length; i += 400) {
    const chunk = deliveries.slice(i, i + 400)
    const batch = db.batch()
    for (const d of chunk) {
      const ref = db
        .collection(OUTREACH_CAMPAIGNS)
        .doc(campaignId)
        .collection('deliveries')
        .doc(d.id)
      batch.set(ref, d)
    }
    await batch.commit()
  }

  return {
    campaign,
    preview: adjusted.slice(0, 20),
  }
}

export async function getCampaign(
  db: Firestore,
  campaignId: string
): Promise<OutreachCampaign | null> {
  const snap = await db.collection(OUTREACH_CAMPAIGNS).doc(campaignId).get()
  if (!snap.exists) return null
  return snap.data() as OutreachCampaign
}

export async function listCampaigns(
  db: Firestore,
  limit = 30
): Promise<OutreachCampaign[]> {
  const snap = await db
    .collection(OUTREACH_CAMPAIGNS)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get()
  return snap.docs.map((d) => d.data() as OutreachCampaign)
}

export async function listDeliveries(
  db: Firestore,
  campaignId: string,
  opts?: { status?: string; limit?: number }
): Promise<OutreachDelivery[]> {
  const col = db.collection(OUTREACH_CAMPAIGNS).doc(campaignId).collection('deliveries')
  const snap = opts?.status
    ? await col.where('status', '==', opts.status).limit(opts?.limit || 100).get()
    : await col.limit(opts?.limit || 100).get()
  return snap.docs.map((d) => d.data() as OutreachDelivery)
}
