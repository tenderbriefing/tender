/**
 * Public customer-facing contact details (not Twilio sender / Meta Business API).
 * Digits-only for wa.me; E.164 for tel: and copy.
 */

/** Official public / office email — primary site contact. */
export const OFFICE_EMAIL = 'info@tenderbriefing.co.za'

/** Support inbox used by tickets and operational support flows. */
export const SUPPORT_EMAIL = 'support@tenderbriefing.co.za'

/** Display telephone (spaces for readability). */
export const OFFICE_PHONE_DISPLAY = '+27 12 004 8728'

/** E.164 without spaces — for tel: hrefs. */
export const OFFICE_PHONE_TEL = '+27120048728'

export const OFFICE_PHONE_HREF = `tel:${OFFICE_PHONE_TEL}`
export const OFFICE_EMAIL_HREF = `mailto:${OFFICE_EMAIL}`

/**
 * Physical office — Byls Bridge Office Park, Centurion.
 * Visible multiline copy; schema uses condensed streetAddress (see structuredData).
 */
export const OFFICE_ADDRESS = {
  building: 'Byls Bridge Office Park',
  floor: 'First Floor, Block B',
  street: 'Olievenhoutbosch Road',
  suburb: 'Doringkloof',
  city: 'Centurion',
  postalCode: '0157',
  region: 'Gauteng',
  country: 'South Africa',
  countryCode: 'ZA',
} as const

/** Multiline address for <address> / UI (includes Doringkloof). */
export const OFFICE_ADDRESS_LINES = [
  OFFICE_ADDRESS.building,
  OFFICE_ADDRESS.floor,
  OFFICE_ADDRESS.street,
  OFFICE_ADDRESS.suburb,
  `${OFFICE_ADDRESS.city}, ${OFFICE_ADDRESS.postalCode}`,
  OFFICE_ADDRESS.country,
] as const

/** Compact trust-strip line for dense UI. */
export const OFFICE_LOCATION_SHORT = 'Centurion, Gauteng'

/** Schema.org streetAddress — park + floor + road (suburb kept visible-only). */
export const OFFICE_STREET_ADDRESS =
  'Byls Bridge Office Park, First Floor, Block B, Olievenhoutbosch Road'

export const PUBLIC_WHATSAPP_DIGITS = '27720708467'
export const PUBLIC_WHATSAPP_E164 = `+${PUBLIC_WHATSAPP_DIGITS}`

export const PUBLIC_WHATSAPP_URL =
  process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT ||
  `https://wa.me/${PUBLIC_WHATSAPP_DIGITS}`

export function publicWhatsAppLink(message?: string) {
  const base = PUBLIC_WHATSAPP_URL
  if (!message) return base
  const sep = base.includes('?') ? '&' : '?'
  return `${base}${sep}text=${encodeURIComponent(message)}`
}
