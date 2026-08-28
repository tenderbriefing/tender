import { createHmac, timingSafeEqual } from 'crypto'

function unsubSecret(env = process.env): string {
  return (
    (env.FOUNDER_OUTREACH_UNSUB_SECRET || '').trim() ||
    (env.SYNC_SECRET || '').trim() ||
    (env.AUTOMATION_SECRET || '').trim()
  )
}

export function normaliseSuppressionEmail(email: string): string {
  return String(email || '')
    .trim()
    .toLowerCase()
}

export function buildUnsubscribeToken(email: string, env = process.env): string | null {
  const secret = unsubSecret(env)
  if (!secret) return null
  const normalised = normaliseSuppressionEmail(email)
  const sig = createHmac('sha256', secret).update(`unsub:v1:${normalised}`).digest('base64url')
  const payload = Buffer.from(JSON.stringify({ e: normalised, v: 1 }), 'utf8').toString('base64url')
  return `${payload}.${sig}`
}

export function verifyUnsubscribeToken(
  token: string,
  env = process.env
): { ok: true; email: string } | { ok: false } {
  const secret = unsubSecret(env)
  if (!secret || !token || !token.includes('.')) return { ok: false }
  const [payload, sig] = token.split('.')
  if (!payload || !sig) return { ok: false }
  let email = ''
  try {
    const json = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    email = normaliseSuppressionEmail(json?.e)
  } catch {
    return { ok: false }
  }
  if (!email || !email.includes('@')) return { ok: false }
  const expected = createHmac('sha256', secret).update(`unsub:v1:${email}`).digest('base64url')
  try {
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false }
  } catch {
    return { ok: false }
  }
  return { ok: true, email }
}
