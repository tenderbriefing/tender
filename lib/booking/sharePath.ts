/** Canonical shareable SME funnel for Youth Agent briefing attendance. */

import { ATTENDANCE_FEE_LABEL } from '@/lib/payments/attendanceFee'

export const SME_BOOK_AGENT_PATH = '/sme/book-agent'

export function requestAgentPath(
  tenderId: string,
  options?: { invite?: string | null }
): string {
  const id = String(tenderId || '').trim()
  const base = `/tenders/${id}/request-agent`
  const invite = options?.invite?.trim()
  if (!invite) return base
  return `${base}?invite=${encodeURIComponent(invite)}`
}

/**
 * WhatsApp / ops deep-link into the book-agent funnel for a specific tender.
 * Private RFQs should always include a signed `invite` so non-owners can pay
 * without the tender appearing on the public catalogue.
 */
export function smeBookAgentDeepLink(
  tenderId: string,
  options?: { invite?: string | null }
): string {
  const id = String(tenderId || '').trim()
  const params = new URLSearchParams()
  params.set('tenderId', id)
  const invite = options?.invite?.trim()
  if (invite) params.set('invite', invite)
  return `${SME_BOOK_AGENT_PATH}?${params.toString()}`
}

/** Absolute payment URL suitable to paste into WhatsApp. */
export function absolutePrivatePaymentUrl(
  tenderId: string,
  options: { invite?: string | null; siteUrl?: string }
): string {
  const origin = (options.siteUrl || 'https://www.tenderbriefing.co.za').replace(
    /\/$/,
    ''
  )
  return `${origin}${smeBookAgentDeepLink(tenderId, { invite: options.invite })}`
}

/** Prefill text for manual WhatsApp share (wa.me). */
export function privatePaymentWhatsAppMessage(
  absoluteUrl: string,
  options?: { tenderLabel?: string | null }
): string {
  const label = options?.tenderLabel?.trim()
  const fee = ATTENDANCE_FEE_LABEL
  const subject = label
    ? `Book a Youth Agent (${fee}) for ${label}`
    : `Book a Youth Agent (${fee}) for your private briefing`
  return `${subject}\n\nPay securely here:\n${absoluteUrl}`
}

export function whatsappShareHref(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`
}

/** Sign-in return URL: deep-link to checkout when tenderId is known. */
export function smeBookAgentSignInHref(
  tenderId?: string | null,
  options?: { invite?: string | null }
): string {
  const returnPath =
    tenderId && tenderId.trim()
      ? requestAgentPath(tenderId.trim(), { invite: options?.invite })
      : SME_BOOK_AGENT_PATH
  return `/auth/signin?redirect=${encodeURIComponent(returnPath)}`
}
