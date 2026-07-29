/**
 * Public customer-facing contact details (not Twilio sender / Meta Business API).
 * Digits-only for wa.me; E.164 for tel: and copy.
 */
export const PUBLIC_WHATSAPP_DIGITS = '27720708467'
export const PUBLIC_WHATSAPP_E164 = `+${PUBLIC_WHATSAPP_DIGITS}`

export const PUBLIC_WHATSAPP_URL =
  process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT ||
  `https://wa.me/${PUBLIC_WHATSAPP_DIGITS}`

export const SUPPORT_EMAIL = 'support@tenderbriefing.co.za'

export function publicWhatsAppLink(message?: string) {
  const base = PUBLIC_WHATSAPP_URL
  if (!message) return base
  const sep = base.includes('?') ? '&' : '?'
  return `${base}${sep}text=${encodeURIComponent(message)}`
}
