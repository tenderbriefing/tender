/**
 * Founder outreach Resend transport — separate channel from transactional email.
 * Does NOT use the transactional notifications ledger.
 * Does NOT check marketing suppression (caller must check before invoking).
 */
import { Resend } from 'resend'

const DEFAULT_FROM = 'TenderBriefing <hello@tenderbriefing.co.za>'
const SUPPORT_EMAIL = 'support@tenderbriefing.co.za'
const LOG_PREFIX = '[founderOutreachEmail]'

export function fromAddress(env: NodeJS.ProcessEnv = process.env): string {
  const raw = (env.RESEND_FROM_EMAIL || '').trim()
  if (!raw) return DEFAULT_FROM
  if (raw.includes('<')) return raw
  return `TenderBriefing <${raw}>`
}

export function getResendClient(env: NodeJS.ProcessEnv = process.env, ResendCtor = Resend) {
  const apiKey = (env.RESEND_API_KEY || '').trim()
  if (!apiKey) return null
  return new ResendCtor(apiKey)
}

export type OutreachSendResult = {
  sent: boolean
  id?: string | null
  errorCode?: string | null
  error?: string
}

export async function sendFounderOutreachEmail(opts: {
  to: string
  subject: string
  html: string
  text: string
  headers?: Record<string, string>
  env?: NodeJS.ProcessEnv
  resendClient?: ReturnType<typeof getResendClient>
}): Promise<OutreachSendResult> {
  const env = opts.env || process.env
  const recipient = String(opts.to || '')
    .trim()
    .toLowerCase()
  if (!recipient || !recipient.includes('@')) {
    return { sent: false, errorCode: 'invalid_recipient', error: 'Invalid recipient email' }
  }

  const client = opts.resendClient || getResendClient(env)
  if (!client) {
    return { sent: false, errorCode: 'provider_auth_error', error: 'RESEND_API_KEY not configured' }
  }

  try {
    const { data, error } = await client.emails.send({
      from: fromAddress(env),
      to: [recipient],
      subject: String(opts.subject || '').slice(0, 200),
      html: opts.html,
      text: opts.text,
      replyTo: SUPPORT_EMAIL,
      headers: {
        'X-TenderBriefing-Channel': 'FOUNDER_OUTREACH',
        ...(opts.headers || {}),
      },
    })

    if (error) {
      const message =
        typeof error === 'object' && error && 'message' in error
          ? String((error as { message?: string }).message)
          : 'Resend send failed'
      const lower = message.toLowerCase()
      let errorCode = 'provider_rejected'
      if (lower.includes('429') || lower.includes('rate')) errorCode = 'provider_rate_limit'
      else if (lower.includes('401') || lower.includes('403') || lower.includes('api key')) {
        errorCode = 'provider_auth_error'
      } else if (/\b5\d\d\b/.test(lower)) errorCode = 'provider_server_error'
      else if (lower.includes('invalid') || lower.includes('recipient')) {
        errorCode = 'invalid_recipient'
      }
      console.error(`${LOG_PREFIX} send failed:`, message.slice(0, 160))
      return { sent: false, errorCode, error: message.slice(0, 200) }
    }

    return { sent: true, id: data?.id || null, errorCode: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected send failure'
    const lower = message.toLowerCase()
    let errorCode = 'unknown'
    if (lower.includes('429') || lower.includes('rate')) errorCode = 'provider_rate_limit'
    else if (lower.includes('timeout') || lower.includes('econn')) errorCode = 'provider_server_error'
    console.error(`${LOG_PREFIX} unexpected:`, message.slice(0, 160))
    return { sent: false, errorCode, error: message.slice(0, 200) }
  }
}

export function isRetryableOutreachError(errorCode: string | null | undefined): boolean {
  return errorCode === 'provider_rate_limit' || errorCode === 'provider_server_error'
}
