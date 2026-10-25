/**
 * Phase 20 — signed SME Connect "YES — ATTEND" CTA tokens.
 * Payload: candidateId:exp:sig (HMAC-SHA256), base64url wrapped.
 */
import { createHmac, timingSafeEqual } from 'crypto'

export const SME_CONNECT_CTA_TTL_MS = 14 * 24 * 60 * 60 * 1000

export type SmeConnectCtaPayload = {
  candidateId: string
  exp: number
}

function resolveSecret(): string {
  const secret =
    process.env.SME_CONNECT_CTA_SECRET ||
    process.env.SYNC_SECRET ||
    process.env.PRIVATE_TENDER_INVITE_SECRET
  if (secret && String(secret).trim()) return String(secret).trim()
  const isProd =
    process.env.NODE_ENV === 'production' ||
    Boolean(process.env.K_SERVICE) ||
    Boolean(process.env.FUNCTION_TARGET)
  if (isProd) {
    throw new Error('SME_CONNECT_CTA_SECRET (or SYNC_SECRET) required in production')
  }
  return 'tb-sme-connect-cta-dev'
}

function signRaw(raw: string): string {
  return createHmac('sha256', resolveSecret()).update(raw).digest('hex').slice(0, 24)
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

export function createSmeConnectCtaToken(
  candidateId: string,
  ttlMs: number = SME_CONNECT_CTA_TTL_MS
): { token: string; expiresAt: string; exp: number } {
  const id = String(candidateId || '').trim()
  if (!id) throw new Error('candidateId required')
  const exp = Date.now() + Math.max(60_000, ttlMs)
  const raw = `${id}:${exp}`
  const sig = signRaw(raw)
  const token = Buffer.from(`${raw}:${sig}`).toString('base64url')
  return { token, expiresAt: new Date(exp).toISOString(), exp }
}

export function verifySmeConnectCtaToken(
  token: string | null | undefined
): SmeConnectCtaPayload | null {
  if (!token || typeof token !== 'string') return null
  try {
    const decoded = Buffer.from(token.trim(), 'base64url').toString('utf8')
    const parts = decoded.split(':')
    if (parts.length < 3) return null
    const sig = parts[parts.length - 1]
    const expStr = parts[parts.length - 2]
    const candidateId = parts.slice(0, -2).join(':')
    const exp = Number(expStr)
    if (!candidateId || !Number.isFinite(exp)) return null
    if (Date.now() > exp) return null
    const raw = `${candidateId}:${exp}`
    if (!safeEqualHex(signRaw(raw), sig)) return null
    return { candidateId, exp }
  } catch {
    return null
  }
}
