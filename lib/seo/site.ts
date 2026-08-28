export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://www.tenderbriefing.co.za'

/** Google Search Console HTML meta tag — content value only (not the full meta tag). */
export const GOOGLE_SITE_VERIFICATION = (
  process.env.GOOGLE_SITE_VERIFICATION ||
  process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ||
  ''
).trim()

export const SITE_NAME = 'TenderBriefing'

export const DEFAULT_OG_IMAGE = '/brand/og-logo.png'

export const ORG_DESCRIPTION =
  'TenderBriefing helps South African SMEs discover compulsory tender briefings and request verified Youth Agents to attend physical briefing sessions on their behalf.'

export const DEFAULT_KEYWORDS = [
  'tender briefing',
  'tender briefing South Africa',
  'compulsory tender briefings',
  'government tenders South Africa',
  'eTenders',
  'SME tenders',
  'youth agent tender support',
  'procurement briefings',
] as const

export function absoluteUrl(path = ''): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${SITE_URL.replace(/\/$/, '')}${normalized}`
}

export function truncateMeta(text: string, max = 160): string {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (cleaned.length <= max) return cleaned
  return `${cleaned.slice(0, max - 1).trim()}…`
}
