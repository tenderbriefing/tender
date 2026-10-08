import { randomBytes } from 'crypto'
import type { Firestore } from 'firebase-admin/firestore'
import { templateVersionForCampaignType } from './campaignTypes'
import type { OutreachCampaignType } from './campaignTypes'
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
  campaignType: OutreachCampaignType
}): Promise<{ campaign: OutreachCampaign; preview: ParsedOutreachRow[] }> {
  const { db, fileName, rows, createdByUid, createdByEmail, campaignType } = params
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

  const templateVersion = templateVersionForCampaignType(campaignType)

  const campaign: OutreachCampaign = {
    id: campaignId,
    type: campaignType,
    templateVersion,
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
      campaignType,
      templateVersion,
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
      templateVersion,
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

const OUTREACH_IDEMPOTENCY = 'founderOutreachIdempotency'

function idempotencyDocId(createdByUid: string, key: string): string {
  const safeUid = String(createdByUid || '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 80)
  const safeKey = String(key || '')
    .replace(/[^a-zA-Z0-9:_-]/g, '_')
    .slice(0, 120)
  return `${safeUid}_${safeKey}`.slice(0, 700)
}

export async function findCampaignByIdempotencyKey(
  db: Firestore,
  createdByUid: string,
  idempotencyKey: string
): Promise<OutreachCampaign | null> {
  const key = String(idempotencyKey || '').trim().slice(0, 200)
  if (!key || !createdByUid) return null
  const snap = await db
    .collection(OUTREACH_IDEMPOTENCY)
    .doc(idempotencyDocId(createdByUid, key))
    .get()
  if (!snap.exists) return null
  const campaignId = String(snap.data()?.campaignId || '')
  if (!campaignId) return null
  return getCampaign(db, campaignId)
}

export async function createComposerCampaign(params: {
  db: Firestore
  createdByUid: string
  createdByEmail: string
  campaignType: OutreachCampaignType
  templateKey: string
  subject: string
  composerHtml: string
  fromAddress: string
  recipients: Array<{
    email: string
    normalisedEmail: string
    field: 'to' | 'cc' | 'bcc'
  }>
  toCount: number
  ccCount: number
  bccCount: number
  idempotencyKey: string
}): Promise<OutreachCampaign> {
  const {
    db,
    createdByUid,
    createdByEmail,
    campaignType,
    templateKey,
    subject,
    composerHtml,
    fromAddress,
    recipients,
  } = params

  // Same suppression authority as compose preview (listSuppressedAmong).
  const readyEmails = recipients.map((r) => r.normalisedEmail)
  const suppressed = await listSuppressedAmong(db, readyEmails)
  const sendable = recipients.filter((r) => !suppressed.has(r.normalisedEmail))
  const suppressedRows = recipients.length - sendable.length
  // Field counts reflect post-suppression sendable population (matches preview).
  const resolvedToCount = sendable.filter((r) => r.field === 'to').length
  const resolvedCcCount = sendable.filter((r) => r.field === 'cc').length
  const resolvedBccCount = sendable.filter((r) => r.field === 'bcc').length
  if (sendable.length === 0) {
    throw new Error('No sendable recipients after suppression filtering.')
  }

  const campaignId = newCampaignId()
  const idempotencyKey = String(params.idempotencyKey || `outreach:${campaignId}`).slice(0, 200)
  const createdAt = nowIso()
  const templateVersion = templateVersionForCampaignType(campaignType)

  const campaign: OutreachCampaign = {
    id: campaignId,
    type: campaignType,
    templateVersion,
    originalFileName: 'composer',
    source: 'composer',
    subject: subject.slice(0, 500),
    composerHtml,
    fromAddress: fromAddress.slice(0, 200),
    toCount: resolvedToCount,
    ccCount: resolvedCcCount,
    bccCount: resolvedBccCount,
    templateKey: templateKey.slice(0, 80),
    totalRows: recipients.length,
    validRows: recipients.length,
    invalidRows: 0,
    duplicateRows: 0,
    suppressedRows,
    sendableRows: sendable.length,
    queuedCount: sendable.length,
    sentCount: 0,
    failedCount: 0,
    skippedCount: suppressedRows,
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
  await db
    .collection(OUTREACH_IDEMPOTENCY)
    .doc(idempotencyDocId(createdByUid, idempotencyKey))
    .set({
      campaignId,
      createdByUid,
      idempotencyKey,
      createdAt,
    })

  console.info(
    JSON.stringify({
      event: 'founder_outreach_composer_campaign_created',
      campaignId,
      campaignType,
      templateKey,
      sendableRows: campaign.sendableRows,
      toCount: resolvedToCount,
      ccCount: resolvedCcCount,
      bccCount: resolvedBccCount,
      suppressedRows,
    })
  )

  const deliveries: OutreachDelivery[] = sendable.map((r, idx) => ({
    id: deliveryIdFor(campaignId, r.normalisedEmail, idx + 1, 'queued'),
    campaignId,
    name: '',
    companyName: '',
    email: r.email,
    normalisedEmail: r.normalisedEmail,
    status: 'queued' as const,
    templateVersion,
    recipientField: r.field,
    resendMessageId: null,
    attemptCount: 0,
    errorCode: null,
    errorMessageSafe: null,
    createdAt,
    updatedAt: createdAt,
    sentAt: null,
  }))

  for (let i = 0; i < deliveries.length; i += 400) {
    const chunk = deliveries.slice(i, i + 400)
    const batch = db.batch()
    for (const d of chunk) {
      batch.set(
        db.collection(OUTREACH_CAMPAIGNS).doc(campaignId).collection('deliveries').doc(d.id),
        d
      )
    }
    await batch.commit()
  }

  return campaign
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
