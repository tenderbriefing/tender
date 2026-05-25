export const AGENT_FIELD_MANIFEST = '/agent-field-manifest.webmanifest'
export const AGENT_FIELD_SW = '/sw-agent-field.js'

export const WHATSAPP_SUPPORT =
  process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT || 'https://wa.me/27123456789'

export function whatsAppLink(message?: string) {
  const base = WHATSAPP_SUPPORT
  if (!message) return base
  const sep = base.includes('?') ? '&' : '?'
  return `${base}${sep}text=${encodeURIComponent(message)}`
}
