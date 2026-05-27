import type { TenderBriefing } from '@/lib/tenderBriefing/types'

/**
 * Returns text trimmed and normalised; empty when no usable content.
 */
function clean(text?: string | null): string | null {
  if (!text) return null
  const trimmed = text.replace(/\s+/g, ' ').trim()
  if (trimmed.length === 0) return null
  return trimmed
}

function isMeaningful(value: string | null, minWords = 6): boolean {
  if (!value) return false
  return value.split(/\s+/).filter(Boolean).length >= minWords
}

const PROCUREMENT_VERBS = [
  'appointment',
  'appoint',
  'provision',
  'supply',
  'supplying',
  'delivery',
  'deliver',
  'maintain',
  'maintenance',
  'install',
  'installation',
  'construct',
  'construction',
  'manage',
  'management',
  'consult',
  'consulting',
  'render',
  'rendering',
  'lease',
  'leasing',
  'hire',
  'hiring',
  'design',
  'develop',
  'development',
  'training',
  'training services',
]

function detectScopePhrase(text: string): string | null {
  const lower = text.toLowerCase()
  for (const verb of PROCUREMENT_VERBS) {
    const idx = lower.indexOf(verb)
    if (idx !== -1) {
      const start = idx
      const fragment = text.slice(start).replace(/\.+$/, '').trim()
      return fragment.length > 220 ? `${fragment.slice(0, 220).trim()}…` : fragment
    }
  }
  return null
}

function buildPlainEnglishLead(tender: TenderBriefing): string {
  const department = tender.department ? `the ${tender.department}` : 'a government department'
  const province = tender.province ? ` in ${tender.province}` : ''
  return `${department} is procuring goods, services or works through this compulsory briefing tender${province}.`
}

export interface DerivedTenderDescription {
  /** Short human-friendly answer to "What is this tender about?" */
  headline: string
  /** Supporting paragraph (1-3 sentences). */
  body: string
  /** Procurement scope keywords/tags. */
  tags: string[]
  /** Raw official notice text (only when it adds value beyond the title). */
  officialNotice: string | null
  /** True when we could not extract anything meaningful and the user should rely on the source. */
  isFallback: boolean
}

export function deriveTenderDescription(tender: TenderBriefing): DerivedTenderDescription {
  const title = clean(tender.title) || ''
  const description = clean(tender.description)
  const summary = clean(tender.summary)

  // Source long-form text: prefer description if it's longer than title, otherwise summary.
  const longestSource = [description, summary]
    .filter(Boolean)
    .filter((t) => t && t.toLowerCase() !== title.toLowerCase())
    .sort((a, b) => (b as string).length - (a as string).length)[0]

  const sourceText = longestSource || description || summary || title

  // Headline = strongest available short statement
  let headline =
    detectScopePhrase(sourceText || '') ||
    detectScopePhrase(title) ||
    title ||
    'Government procurement opportunity'

  // Sentence-case clean up
  headline = headline.replace(/^\W+/, '').trim()
  if (headline.length > 180) headline = `${headline.slice(0, 180).trim()}…`

  // Body construction
  const bodyParts: string[] = []
  if (sourceText && sourceText !== title && isMeaningful(sourceText)) {
    bodyParts.push(sourceText)
  } else {
    bodyParts.push(buildPlainEnglishLead(tender))
  }

  if (tender.briefingCompulsory) {
    bodyParts.push(
      'Attendance at the compulsory briefing session is required — submissions from non-attending bidders may be disqualified.'
    )
  }
  if (tender.industrySector) {
    bodyParts.push(`Primary sector: ${tender.industrySector}.`)
  }

  const body = bodyParts.join(' ').replace(/\s+/g, ' ').trim()

  // Tags — sector / category / procurement method / province
  const tagSet = new Set<string>()
  if (tender.industrySector) tagSet.add(tender.industrySector)
  if (tender.category && tender.category.toLowerCase() !== (tender.industrySector || '').toLowerCase()) {
    tagSet.add(tender.category)
  }
  if (tender.procurementMethod) tagSet.add(tender.procurementMethod)
  if (tender.province) tagSet.add(tender.province)
  const matched = Array.isArray(tender.matchedBriefingTerms) ? tender.matchedBriefingTerms : []
  matched.slice(0, 3).forEach((m) => m && tagSet.add(m))
  const tags = Array.from(tagSet).slice(0, 6)

  // Official notice only when it differs meaningfully from headline/body
  const noticeCandidate = description && description !== title ? description : null
  const officialNotice =
    noticeCandidate && noticeCandidate !== body && isMeaningful(noticeCandidate) ? noticeCandidate : null

  const isFallback = !longestSource && !isMeaningful(title)

  return {
    headline,
    body,
    tags,
    officialNotice,
    isFallback,
  }
}
