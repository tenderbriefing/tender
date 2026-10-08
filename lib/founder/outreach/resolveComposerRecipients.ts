/**
 * Shared composer recipient resolution: parse → dedupe → suppression.
 * Preview and create/send must use the same sendable population.
 */
import type { Firestore } from 'firebase-admin/firestore'
import {
  parseRecipientFields,
  type ParsedRecipient,
} from './parseRecipients'
import { listSuppressedAmong } from './suppression'
import { OUTREACH_MAX_RECIPIENTS } from './featureFlag'

export type ComposerRecipientResolution = {
  rawRecipients: number
  duplicatesRemoved: number
  invalidEmails: number
  suppressedRecipients: string[]
  sendable: ParsedRecipient[]
  sendableRecipients: number
  individualEmails: number
  confirmCount: number
  toCount: number
  ccCount: number
  bccCount: number
  exceedsMax: boolean
  maxRecipients: number
}

/** Pure: apply an already-loaded suppression set to parse output. */
export function applySuppressionToParsed(
  parsed: ReturnType<typeof parseRecipientFields>,
  suppressedSet: Set<string>
): ComposerRecipientResolution {
  const duplicatesRemoved = parsed.invalid.filter((r) =>
    String(r.reason || '').startsWith('duplicate_')
  ).length
  const invalidEmails = parsed.invalid.filter((r) => r.reason === 'invalid_email').length
  const suppressedRecipients = parsed.sendable
    .filter((r) => suppressedSet.has(r.normalisedEmail))
    .map((r) => r.normalisedEmail)
  const sendable = parsed.sendable.filter((r) => !suppressedSet.has(r.normalisedEmail))
  const toCount = sendable.filter((r) => r.field === 'to').length
  const ccCount = sendable.filter((r) => r.field === 'cc').length
  const bccCount = sendable.filter((r) => r.field === 'bcc').length
  const sendableRecipients = sendable.length

  return {
    rawRecipients: parsed.recipients.length,
    duplicatesRemoved,
    invalidEmails,
    suppressedRecipients,
    sendable,
    sendableRecipients,
    individualEmails: sendableRecipients,
    confirmCount: sendableRecipients,
    toCount,
    ccCount,
    bccCount,
    exceedsMax: sendableRecipients > parsed.maxRecipients,
    maxRecipients: parsed.maxRecipients,
  }
}

/** Async: parse fields and apply Firestore emailSuppressions (same as create). */
export async function resolveComposerRecipients(
  db: Firestore,
  input: {
    to?: string | string[]
    cc?: string | string[]
    bcc?: string | string[]
    maxRecipients?: number
  }
): Promise<{
  parsed: ReturnType<typeof parseRecipientFields>
  resolution: ComposerRecipientResolution
}> {
  const parsed = parseRecipientFields({
    to: input.to,
    cc: input.cc,
    bcc: input.bcc,
    maxRecipients: input.maxRecipients ?? OUTREACH_MAX_RECIPIENTS,
  })
  const suppressedSet = await listSuppressedAmong(
    db,
    parsed.sendable.map((r) => r.normalisedEmail)
  )
  return { parsed, resolution: applySuppressionToParsed(parsed, suppressedSet) }
}
