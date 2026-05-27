import type { TenderBriefing } from '@/lib/tenderBriefing/types'

/**
 * Returns text trimmed and normalised; empty when no usable content.
 */
function clean(text?: string | null): string | null {
  if (!text) return null
  const trimmed = text.replace(/\r\n/g, '\n').replace(/\s+/g, ' ').trim()
  if (trimmed.length === 0) return null
  return trimmed
}

function wordCount(value: string): number {
  return value.split(/\s+/).filter(Boolean).length
}

function isMeaningful(value: string | null, minWords = 4): boolean {
  if (!value) return false
  return wordCount(value) >= minWords
}

function toSentenceCase(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return trimmed
  const letters = trimmed.replace(/[^a-zA-Z]/g, '')
  const upperRatio = letters.length
    ? letters.replace(/[^A-Z]/g, '').length / letters.length
    : 0
  if (upperRatio < 0.7) return trimmed
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase()
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
  'demolition',
  'demolish',
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
  'upgrade',
  'upgrading',
  'repair',
  'repairs',
  'refurbish',
  'manufacture',
  'procure',
  'procurement',
]

const BOILERPLATE_PREFIX =
  /^(?:request\s+for\s+(?:quotation|quotations|proposal|proposals|bid|bids|tender|tenders)|rfq|rfp|tender\s+notice|notice\s+for\s+tender|invitation\s+to\s+bid|advert(?:isement)?)\b[^.:\n]{0,120}?(?:for|to)\s+/i

const APPOINTMENT_PREFIX =
  /^appointment\s+of\s+(?:a|an|the)?\s*(?:service\s+provider|contractor|consultant|supplier|bidder)?\s*(?:for|to)\s+/i

function stripBoilerplate(text: string): string {
  return text
    .replace(BOILERPLATE_PREFIX, '')
    .replace(APPOINTMENT_PREFIX, '')
    .replace(/^[-–—:\s]+/, '')
    .trim()
}

function isLikelyReferenceCode(title: string): boolean {
  const cleaned = title.trim()
  if (cleaned.length > 120) return false
  const lower = cleaned.toLowerCase()
  const hasScopeVerb = PROCUREMENT_VERBS.some((verb) => lower.includes(verb))
  if (hasScopeVerb) return false
  if (/^(supply|provision|appointment|construction|demolition|consulting)\b/i.test(cleaned)) {
    return false
  }
  return (
    wordCount(cleaned) <= 8 &&
    (/^[A-Z0-9][A-Z0-9./\-_\s]{2,}$/i.test(cleaned) || /\b\d{4,}\b/.test(cleaned))
  )
}

function detectScopePhrase(text: string): string | null {
  const lower = text.toLowerCase()
  let best: { idx: number; verb: string } | null = null

  for (const verb of PROCUREMENT_VERBS) {
    const idx = lower.indexOf(verb)
    if (idx === -1) continue
    if (!best || idx < best.idx) best = { idx, verb }
  }

  if (!best) return null

  const fragment = stripBoilerplate(text.slice(best.idx).replace(/\.+$/, '').trim())
  if (!fragment || wordCount(fragment) < 3) return null
  return fragment.length > 260 ? `${fragment.slice(0, 260).trim()}…` : fragment
}

function extractScopeStatement(text: string | null): string | null {
  if (!text) return null
  const cleaned = clean(text)
  if (!cleaned) return null

  const stripped = stripBoilerplate(cleaned)
  const fromVerb = detectScopePhrase(stripped) || detectScopePhrase(cleaned)
  if (fromVerb && wordCount(fromVerb) >= 3) return toSentenceCase(fromVerb)

  if (isMeaningful(stripped, 3) && stripped.length <= 320) return toSentenceCase(stripped)
  if (isMeaningful(cleaned, 3) && cleaned.length <= 320) return toSentenceCase(cleaned)

  return null
}

function inferScopeType(tender: TenderBriefing, scopeText: string): 'goods' | 'services' | 'works' | 'general' {
  const haystack = [
    scopeText,
    tender.description,
    tender.title,
    tender.category,
    tender.industrySector,
    tender.procurementMethod,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if (/\b(construction|demolition|civil engineering|building works|road works|infrastructure works|works contract)\b/.test(haystack)) {
    return 'works'
  }
  if (/\b(supply|supplies|goods|equipment|materials|consumables|hardware|furniture|vehicles|parts)\b/.test(haystack)) {
    return 'goods'
  }
  if (/\b(service|services|consulting|maintenance|training|cleaning|security|professional|advisory)\b/.test(haystack)) {
    return 'services'
  }
  return 'general'
}

function labelForScopeType(type: 'goods' | 'services' | 'works' | 'general'): string {
  switch (type) {
    case 'goods':
      return 'Goods required'
    case 'services':
      return 'Service required'
    case 'works':
      return 'Works required'
    default:
      return 'Scope of work'
  }
}

function isMetaSummary(text: string, title: string): boolean {
  const lower = text.toLowerCase()
  const titleLower = title.toLowerCase()
  if (lower.startsWith(titleLower) && lower.includes('issued by')) return true
  if (lower.includes('compulsory briefing on') && lower.includes('closes ')) return true
  return false
}

function buildPlainEnglishLead(tender: TenderBriefing, scopeType: ReturnType<typeof inferScopeType>): string {
  const department = tender.department ? tender.department : 'A government department'
  const province = tender.province ? ` in ${tender.province}` : ''
  const category = tender.category || tender.industrySector
  const categoryHint = category ? ` (${category})` : ''

  const need =
    scopeType === 'goods'
      ? 'goods or equipment'
      : scopeType === 'services'
        ? 'professional services'
        : scopeType === 'works'
          ? 'construction or maintenance works'
          : 'goods, services or works'

  return `${department}${province} is inviting suppliers for ${need}${categoryHint} through this tender opportunity.`
}

export interface DerivedTenderDescription {
  /** Short human-friendly answer to "What is this tender about?" */
  headline: string
  /** Explicit product/service/works statement shown above the fold. */
  scopeStatement: string
  scopeType: 'goods' | 'services' | 'works' | 'general'
  scopeTypeLabel: string
  /** Supporting paragraph (1-3 sentences). */
  body: string
  /** Procurement scope keywords/tags. */
  tags: string[]
  /** Raw official notice text for the expandable section. */
  officialNotice: string | null
  /** True when we could not extract anything meaningful and the user should rely on the source. */
  isFallback: boolean
}

export function deriveTenderDescription(tender: TenderBriefing): DerivedTenderDescription {
  const title = clean(tender.title) || ''
  const description = clean(tender.description)
  const summary = clean(tender.summary)

  const noticeParts = [description, summary]
    .filter(Boolean)
    .filter((t, idx, arr) => arr.indexOf(t) === idx)
    .filter((t) => t && t.toLowerCase() !== title.toLowerCase())
    .filter((t) => !isMetaSummary(t as string, title))

  const longestNotice = noticeParts.sort((a, b) => (b as string).length - (a as string).length)[0] || null

  const scopeFromDescription = extractScopeStatement(description)
  const scopeFromTitle = extractScopeStatement(title)
  const scopeFromNotice = extractScopeStatement(longestNotice)

  let scopeStatement =
    scopeFromDescription ||
    scopeFromNotice ||
    (!isLikelyReferenceCode(title) ? scopeFromTitle : null) ||
    scopeFromTitle ||
    title ||
    'Scope details not published in the official feed yet.'

  scopeStatement = scopeStatement.replace(/^\W+/, '').trim()
  if (scopeStatement.length > 220) {
    scopeStatement = `${scopeStatement.slice(0, 220).trim()}…`
  }

  const scopeType = inferScopeType(tender, scopeStatement)
  const scopeTypeLabel = labelForScopeType(scopeType)

  const headline = scopeStatement

  const bodyParts: string[] = []
  const lead = buildPlainEnglishLead(tender, scopeType)
  if (longestNotice && longestNotice !== scopeStatement && isMeaningful(longestNotice)) {
    bodyParts.push(toSentenceCase(longestNotice))
  } else if (!isMeaningful(scopeStatement, 6) || isLikelyReferenceCode(title)) {
    bodyParts.push(lead)
  } else {
    bodyParts.push(lead)
  }

  if (tender.deliveryLocation) {
    bodyParts.push(`Delivery or project location: ${tender.deliveryLocation}.`)
  }

  if (tender.briefingCompulsory) {
    bodyParts.push(
      'Attendance at the compulsory briefing session is required — submissions from non-attending bidders may be disqualified.'
    )
  }

  const body = bodyParts.join(' ').replace(/\s+/g, ' ').trim()

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

  const officialNotice =
    longestNotice && longestNotice.length > scopeStatement.length + 20
      ? longestNotice
      : description && description !== scopeStatement && isMeaningful(description)
        ? description
        : null

  const isFallback =
    !scopeFromDescription &&
    !scopeFromNotice &&
    (isLikelyReferenceCode(title) || !isMeaningful(title, 4))

  return {
    headline,
    scopeStatement,
    scopeType,
    scopeTypeLabel,
    body,
    tags,
    officialNotice,
    isFallback,
  }
}
