/**
 * Sending reputation / volume controls for Outreach.
 * Fail-closed: bulk remains blocked unless Founder explicitly enables.
 */
import type { Firestore } from 'firebase-admin/firestore'

export const OUTREACH_RUNTIME_DOC = 'founderOutreachRuntime'
export const OUTREACH_RUNTIME_CONFIG_ID = 'config'

/** Hard ceiling while bulk is unauthorized (controlled tests only). */
export const OUTREACH_CONTROLLED_MAX_RECIPIENTS = 5

/** Pause thresholds over a rolling window of recent submitted deliveries. */
export const OUTREACH_BOUNCE_PAUSE_RATE = 0.08
export const OUTREACH_COMPLAINT_PAUSE_RATE = 0.004
export const OUTREACH_REPUTATION_MIN_SAMPLE = 20

export type OutreachRuntimeConfig = {
  bulkAuthorized: boolean
  paused: boolean
  pauseReason: string | null
  pausedAt: string | null
  controlledMaxRecipients: number
  updatedAt: string | null
}

export function isOutreachBulkAuthorized(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  const v = String(env.OUTREACH_BULK_AUTHORIZED || '')
    .trim()
    .toLowerCase()
  return v === '1' || v === 'true' || v === 'yes' || v === 'on'
}

export function controlledRecipientCap(env: NodeJS.ProcessEnv = process.env): number {
  const raw = Number(env.OUTREACH_CONTROLLED_MAX_RECIPIENTS || OUTREACH_CONTROLLED_MAX_RECIPIENTS)
  if (!Number.isFinite(raw) || raw < 1) return OUTREACH_CONTROLLED_MAX_RECIPIENTS
  return Math.min(25, Math.floor(raw))
}

export async function getOutreachRuntimeConfig(db: Firestore): Promise<OutreachRuntimeConfig> {
  const snap = await db.collection(OUTREACH_RUNTIME_DOC).doc(OUTREACH_RUNTIME_CONFIG_ID).get()
  const data = snap.exists ? snap.data() || {} : {}
  return {
    bulkAuthorized: Boolean(data.bulkAuthorized) && isOutreachBulkAuthorized(),
    paused: Boolean(data.paused),
    pauseReason: data.pauseReason ? String(data.pauseReason) : null,
    pausedAt: data.pausedAt ? String(data.pausedAt) : null,
    controlledMaxRecipients: controlledRecipientCap(),
    updatedAt: data.updatedAt ? String(data.updatedAt) : null,
  }
}

export async function setOutreachPaused(
  db: Firestore,
  paused: boolean,
  reason: string | null
): Promise<void> {
  await db
    .collection(OUTREACH_RUNTIME_DOC)
    .doc(OUTREACH_RUNTIME_CONFIG_ID)
    .set(
      {
        paused,
        pauseReason: reason,
        pausedAt: paused ? new Date().toISOString() : null,
        updatedAt: new Date().toISOString(),
        // Never auto-enable bulk from this helper
        bulkAuthorized: false,
      },
      { merge: true }
    )
}

export type ReputationGateResult = {
  ok: boolean
  code?: string
  error?: string
  maxAllowed: number
  bulkAuthorized: boolean
  paused: boolean
}

export async function assertOutreachSendAllowed(
  db: Firestore,
  sendableCount: number,
  env: NodeJS.ProcessEnv = process.env
): Promise<ReputationGateResult> {
  const runtime = await getOutreachRuntimeConfig(db)
  const bulk = isOutreachBulkAuthorized(env) && runtime.bulkAuthorized
  const maxAllowed = bulk ? Number(env.OUTREACH_MAX_RECIPIENTS || 2000) : controlledRecipientCap(env)

  if (runtime.paused) {
    return {
      ok: false,
      code: 'reputation_paused',
      error: runtime.pauseReason || 'Outreach sending is paused due to deliverability reputation controls.',
      maxAllowed,
      bulkAuthorized: bulk,
      paused: true,
    }
  }

  if (!bulk && sendableCount > maxAllowed) {
    return {
      ok: false,
      code: 'bulk_blocked',
      error: `Bulk outreach is blocked. Controlled maximum is ${maxAllowed} recipients per campaign.`,
      maxAllowed,
      bulkAuthorized: false,
      paused: false,
    }
  }

  return {
    ok: true,
    maxAllowed,
    bulkAuthorized: bulk,
    paused: false,
  }
}

export function shouldPauseForRates(input: {
  sampleSize: number
  bounced: number
  complained: number
}): { pause: boolean; reason: string | null } {
  if (input.sampleSize < OUTREACH_REPUTATION_MIN_SAMPLE) {
    return { pause: false, reason: null }
  }
  const bounceRate = input.bounced / input.sampleSize
  const complaintRate = input.complained / input.sampleSize
  if (complaintRate >= OUTREACH_COMPLAINT_PAUSE_RATE) {
    return {
      pause: true,
      reason: `Complaint rate ${(complaintRate * 100).toFixed(2)}% exceeded pause threshold.`,
    }
  }
  if (bounceRate >= OUTREACH_BOUNCE_PAUSE_RATE) {
    return {
      pause: true,
      reason: `Bounce rate ${(bounceRate * 100).toFixed(2)}% exceeded pause threshold.`,
    }
  }
  return { pause: false, reason: null }
}
