/**
 * Parse pasted To / CC / BCC addresses into validated, deduplicated tokens.
 */
import { OUTREACH_MAX_RECIPIENTS } from './featureFlag'

export type RecipientField = 'to' | 'cc' | 'bcc'

export type ParsedRecipient = {
  email: string
  normalisedEmail: string
  field: RecipientField
  valid: boolean
  reason?: string
}

const EMAIL_RE =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i

export function normaliseEmail(raw: string): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
}

export function isValidEmailSyntax(raw: string): boolean {
  const e = normaliseEmail(raw)
  if (!e || e.length > 254) return false
  if (e.includes('..') || e.startsWith('.') || e.endsWith('.')) return false
  return EMAIL_RE.test(e)
}

/** Split pasted blobs on commas, semicolons, whitespace, and newlines. */
export function splitRecipientTokens(raw: string): string[] {
  return String(raw || '')
    .split(/[\s,;]+/g)
    .map((t) => t.trim())
    .filter(Boolean)
}

/**
 * Parse To / CC / BCC. Dedupes across fields with priority: to > cc > bcc.
 * Invalid tokens are kept with valid:false for UI feedback (not sendable).
 */
export function parseRecipientFields(input: {
  to?: string | string[]
  cc?: string | string[]
  bcc?: string | string[]
  maxRecipients?: number
}): {
  recipients: ParsedRecipient[]
  sendable: ParsedRecipient[]
  invalid: ParsedRecipient[]
  toCount: number
  ccCount: number
  bccCount: number
  totalSendable: number
  exceedsMax: boolean
  maxRecipients: number
} {
  const maxRecipients = input.maxRecipients ?? OUTREACH_MAX_RECIPIENTS
  const seen = new Map<string, RecipientField>()
  const recipients: ParsedRecipient[] = []

  const ingest = (field: RecipientField, raw: string | string[] | undefined) => {
    const chunks = Array.isArray(raw) ? raw.flatMap((r) => splitRecipientTokens(r)) : splitRecipientTokens(raw || '')
    for (const token of chunks) {
      const normalisedEmail = normaliseEmail(token)
      if (!normalisedEmail) continue
      if (!isValidEmailSyntax(normalisedEmail)) {
        recipients.push({
          email: token.trim(),
          normalisedEmail,
          field,
          valid: false,
          reason: 'invalid_email',
        })
        continue
      }
      const prior = seen.get(normalisedEmail)
      if (prior) {
        recipients.push({
          email: normalisedEmail,
          normalisedEmail,
          field,
          valid: false,
          reason: `duplicate_${prior}`,
        })
        continue
      }
      seen.set(normalisedEmail, field)
      recipients.push({
        email: normalisedEmail,
        normalisedEmail,
        field,
        valid: true,
      })
    }
  }

  ingest('to', input.to)
  ingest('cc', input.cc)
  ingest('bcc', input.bcc)

  const sendable = recipients.filter((r) => r.valid)
  const invalid = recipients.filter((r) => !r.valid)
  const toCount = sendable.filter((r) => r.field === 'to').length
  const ccCount = sendable.filter((r) => r.field === 'cc').length
  const bccCount = sendable.filter((r) => r.field === 'bcc').length

  return {
    recipients,
    sendable,
    invalid,
    toCount,
    ccCount,
    bccCount,
    totalSendable: sendable.length,
    exceedsMax: sendable.length > maxRecipients,
    maxRecipients,
  }
}
