/**
 * Signed invite tokens for private / WhatsApp RFQ payment links.
 * Grants authenticated SMEs book access to a private tender without listing it publicly.
 */
import { createHmac, timingSafeEqual } from 'crypto'

/** Default TTL for WhatsApp-shareable payment invites (14 days). */
export const PRIVATE_INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000

export type PrivateInvitePayload = {
  tenderId: string
  exp: number
}

function resolveInviteSecret(): string {
  const secret =
    process.env.PRIVATE_TENDER_INVITE_SECRET ||
    process.env.SYNC_SECRET ||
    process.env.MOBILE_UPLOAD_SECRET
  if (secret && String(secret).trim()) return String(secret).trim()

  const isProd =
    process.env.NODE_ENV === 'production' ||
    Boolean(process.env.K_SERVICE) ||
    Boolean(process.env.FUNCTION_TARGET)

  if (isProd) {
    throw new Error(
      'PRIVATE_TENDER_INVITE_SECRET (or SYNC_SECRET) required in production for private payment invites'
    )
  }
  return 'tb-private-invite-dev'
}

function signRaw(raw: string): string {
  return createHmac('sha256', resolveInviteSecret()).update(raw).digest('hex').slice(0, 24)
}

function safeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, 'utf8')
    const bb = Buffer.from(b, 'utf8')
    if (ba.length !== bb.length) return false
    return timingSafeEqual(ba, bb)
  } catch {
    return false
  }
}

/** Create a compact base64url invite for a private tender id. */
export function createPrivateTenderInvite(
  tenderId: string,
  ttlMs: number = PRIVATE_INVITE_TTL_MS
): { token: string; expiresAt: string; exp: number } {
  const id = String(tenderId || '').trim()
  if (!id) throw new Error('tenderId required for invite')
  const exp = Date.now() + Math.max(60_000, ttlMs)
  const raw = `${id}:${exp}`
  const sig = signRaw(raw)
  const token = Buffer.from(`${raw}:${sig}`).toString('base64url')
  return { token, expiresAt: new Date(exp).toISOString(), exp }
}

/** Verify invite; returns payload when valid, else null. */
export function verifyPrivateTenderInvite(
  token: string | null | undefined,
  expectedTenderId?: string | null
): PrivateInvitePayload | null {
  if (!token || typeof token !== 'string') return null
  try {
    const decoded = Buffer.from(token.trim(), 'base64url').toString('utf8')
    const parts = decoded.split(':')
    if (parts.length < 3) return null
    const sig = parts[parts.length - 1]
    const expStr = parts[parts.length - 2]
    const tenderId = parts.slice(0, -2).join(':')
    const exp = Number(expStr)
    if (!tenderId || !Number.isFinite(exp)) return null
    if (Date.now() > exp) return null
    const raw = `${tenderId}:${exp}`
    const expected = signRaw(raw)
    if (!safeEqualHex(sig, expected)) return null
    if (expectedTenderId && tenderId !== String(expectedTenderId).trim()) return null
    return { tenderId, exp }
  } catch {
    return null
  }
}

/** True when an authenticated SME may book this private tender via a valid invite. */
export function smeHasPrivateBookAccess(options: {
  tender: { visibility?: string; ownerUid?: string; id: string }
  smeUid: string
  inviteToken?: string | null
}): boolean {
  const { tender, smeUid, inviteToken } = options
  if (tender.visibility !== 'private') return true
  if (tender.ownerUid && tender.ownerUid === smeUid) return true
  return Boolean(verifyPrivateTenderInvite(inviteToken, tender.id))
}
