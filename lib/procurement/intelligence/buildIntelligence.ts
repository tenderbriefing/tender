import type { TenderBriefing } from '@/lib/tenderBriefing/types'
import type {
  ChecklistItem,
  EligibilityAssessment,
  OpportunityFitScore,
  RecommendedAction,
  SmeProfileInput,
  StructuredTenderFacts,
  TenderIntelligenceSummary,
  FactField,
  FactKind,
  ProcurementIntelligenceResult,
} from './types'
import {
  INTELLIGENCE_SCHEMA_VERSION,
  SCORING_RULES_VERSION,
} from './types'

function fact<T>(
  value: T | null | undefined,
  kind: FactKind = value == null || value === '' ? 'unavailable' : 'verified'
): FactField<T> {
  if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) {
    return { value: null, kind: 'unavailable' }
  }
  return { value: value as T, kind }
}

export function extractStructuredFacts(tender: TenderBriefing): StructuredTenderFacts {
  const docs = (tender.documents || [])
    .map((d) => d.url || d.title || '')
    .filter(Boolean)

  return {
    tenderId: tender.id,
    sourceId: tender.source || tender.buyer || null,
    issuer: fact(tender.buyer || tender.department),
    department: fact(tender.department),
    title: fact(tender.title),
    description: fact(tender.description || tender.summary),
    category: fact(tender.category || tender.industrySector),
    province: fact(tender.province),
    location: fact(tender.briefingVenue || tender.province),
    estimatedValue: fact(null as string | null),
    currency: fact('ZAR', 'inferred'),
    publicationDate: fact(tender.publishedDate),
    briefingDate: fact(tender.briefingDate),
    clarificationDeadline: fact(null as string | null),
    closingDate: fact(tender.closingDate),
    closingTime: fact(tender.briefingTime ? null : null),
    submissionMethod: fact(tender.procurementMethod || null),
    compulsoryBriefing: fact(
      typeof tender.briefingCompulsory === 'boolean' ? tender.briefingCompulsory : null,
      typeof tender.briefingCompulsory === 'boolean' ? 'verified' : 'unavailable'
    ),
    cidbRequired: fact(null as string | null),
    bbbeeRequired: fact(null as string | null),
    csdRequired: fact('required', 'inferred'),
    taxComplianceRequired: fact('required', 'inferred'),
    coidaRequired: fact(null as string | null),
    localContent: fact(null as string | null),
    mandatoryDocuments: fact(docs.length ? docs : null, docs.length ? 'verified' : 'unavailable'),
    disqualifiers: fact(
      tender.briefingCompulsory
        ? ['Failure to attend compulsory briefing (if confirmed compulsory)']
        : null,
      tender.briefingCompulsory ? 'inferred' : 'unavailable'
    ),
    contactDetails: fact(tender.contactPerson || tender.contactEmail || tender.contactPhone),
    documentLinks: fact(docs.length ? docs : null),
  }
}

function profileHas(
  sme: SmeProfileInput,
  field: keyof SmeProfileInput,
  complianceKey?: string
): boolean {
  const direct = sme[field]
  if (direct === true) return true
  if (typeof direct === 'string' && direct.length > 0) return true
  if (typeof direct === 'number' && direct > 0) return true
  if (complianceKey && sme.compliance?.[complianceKey]) return true
  return false
}

export function assessEligibility(
  tender: TenderBriefing,
  sme: SmeProfileInput
): EligibilityAssessment {
  const matched: string[] = []
  const unmet: string[] = []
  const needsVerification: string[] = []
  const missingProfileFields: string[] = []
  const potentialDisqualifiers: string[] = []
  const remediation: string[] = []

  if (sme.province && tender.province && sme.province === tender.province) {
    matched.push(`Province match: ${sme.province}`)
  } else if (tender.province) {
    needsVerification.push(`Confirm delivery capacity in ${tender.province}`)
  }

  const cats = [...(sme.categories || []), ...(sme.sectors || []), ...(sme.commodities || [])]
  const hay = [tender.title, tender.description, tender.category, tender.industrySector]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  let catHit = false
  for (const c of cats) {
    if (c && hay.includes(String(c).toLowerCase())) {
      matched.push(`Category/keyword fit: ${c}`)
      catHit = true
    }
  }
  if (!catHit && cats.length === 0) {
    missingProfileFields.push('categories / commodities')
    remediation.push('Complete SME category profile for better fit assessment')
  } else if (!catHit && hay) {
    unmet.push('No clear category overlap with tender description')
    remediation.push('Review tender scope against your registered commodities')
  }

  if (profileHas(sme, 'csdRegistered', 'csd')) matched.push('CSD registration on profile')
  else {
    unmet.push('CSD registration not confirmed on profile')
    missingProfileFields.push('csdRegistered')
    remediation.push('Register or confirm CSD status on your profile')
  }

  if (profileHas(sme, 'taxClearanceValid', 'tax')) matched.push('Tax clearance indicated')
  else {
    unmet.push('Tax clearance not confirmed')
    missingProfileFields.push('taxClearanceValid')
    remediation.push('Upload/confirm valid tax clearance')
  }

  if (tender.briefingCompulsory) {
    potentialDisqualifiers.push('Compulsory briefing attendance may be required')
    needsVerification.push('Confirm compulsory briefing attendance or book an agent')
    remediation.push('Book a Youth Agent or attend the compulsory briefing')
  }

  let classification: EligibilityAssessment['classification'] = 'eligibility_uncertain'
  if (missingProfileFields.length >= 3 && matched.length < 2) {
    classification = 'insufficient_information'
  } else if (unmet.length >= 3 && matched.length === 0) {
    classification = 'likely_ineligible'
  } else if (unmet.length === 0 && matched.length >= 2 && !tender.briefingCompulsory) {
    classification = 'likely_eligible'
  } else if (matched.length >= 1) {
    classification = 'potentially_eligible'
  }

  // Never definitive in Phase 1
  return {
    classification,
    matched,
    unmet,
    needsVerification,
    missingProfileFields: Array.from(new Set(missingProfileFields)),
    potentialDisqualifiers,
    remediation: Array.from(new Set(remediation)),
    definitiveEligible: false,
  }
}

export function computeOpportunityFit(
  tender: TenderBriefing,
  sme: SmeProfileInput,
  eligibility: EligibilityAssessment
): OpportunityFitScore {
  let score = 50
  const factors: OpportunityFitScore['factors'] = []

  const bump = (id: string, label: string, delta: number) => {
    score += delta
    factors.push({
      id,
      label,
      delta,
      direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'neutral',
    })
  }

  if (sme.province && tender.province && sme.province === tender.province) {
    bump('geo', 'Geographic fit', 12)
  }
  if (eligibility.matched.some((m) => m.startsWith('Category'))) {
    bump('category', 'Category overlap', 15)
  }
  if (tender.briefingCompulsory) {
    bump('briefing', 'Compulsory briefing complexity', -8)
  }
  if (eligibility.classification === 'likely_eligible') bump('elig', 'Strong eligibility signals', 10)
  if (eligibility.classification === 'likely_ineligible') bump('elig_bad', 'Weak eligibility signals', -20)
  if (eligibility.classification === 'insufficient_information') {
    bump('info', 'Incomplete profile/tender data', -12)
  }
  if (eligibility.unmet.includes('CSD registration not confirmed on profile')) {
    bump('csd', 'Missing CSD confirmation', -10)
  }

  const closing = tender.closingDate ? new Date(tender.closingDate).getTime() : NaN
  if (!Number.isNaN(closing)) {
    const days = Math.ceil((closing - Date.now()) / 86400000)
    if (days >= 0 && days <= 5) bump('deadline', 'Closing within 5 days', -15)
    else if (days > 14) bump('deadline_ok', 'Adequate time to closing', 5)
  }

  score = Math.max(0, Math.min(100, Math.round(score)))
  return {
    score,
    label: 'Opportunity Fit',
    rulesVersion: SCORING_RULES_VERSION,
    factors,
  }
}

export function buildChecklist(
  tender: TenderBriefing,
  eligibility: EligibilityAssessment
): ChecklistItem[] {
  const items: ChecklistItem[] = [
    {
      id: 'csd',
      group: 'company_compliance',
      label: 'CSD registration current',
      required: true,
      status: eligibility.matched.some((m) => m.includes('CSD'))
        ? 'available'
        : 'missing',
      smeAction: 'Confirm CSD on profile',
      sourceReference: 'Inferred SA public procurement baseline',
    },
    {
      id: 'tax',
      group: 'company_compliance',
      label: 'Tax clearance valid',
      required: true,
      status: eligibility.matched.some((m) => m.includes('Tax'))
        ? 'available'
        : 'missing',
      smeAction: 'Confirm tax clearance',
    },
    {
      id: 'briefing',
      group: 'briefing_site_visit',
      label: 'Compulsory briefing attendance',
      required: Boolean(tender.briefingCompulsory),
      status: tender.briefingCompulsory ? 'needs_verification' : 'not_applicable',
      smeAction: tender.briefingCompulsory
        ? 'Attend briefing or book a Youth Agent'
        : undefined,
      sourceReference: tender.briefingCompulsory ? 'tender.briefingCompulsory' : undefined,
    },
    {
      id: 'docs',
      group: 'submission_forms',
      label: 'Review tender returnable documents',
      required: true,
      status: (tender.documents || []).length ? 'needs_verification' : 'missing',
      smeAction: 'Download and review attached documents',
    },
    {
      id: 'closing',
      group: 'final_submission',
      label: 'Confirm closing date and submission channel',
      required: true,
      status: tender.closingDate ? 'needs_verification' : 'missing',
      sourceReference: 'tender.closingDate',
    },
  ]
  return items
}

export function detectMissingDocuments(
  eligibility: EligibilityAssessment,
  checklist: ChecklistItem[]
): string[] {
  const missing = [
    ...eligibility.unmet,
    ...checklist.filter((c) => c.status === 'missing' && c.required).map((c) => c.label),
  ]
  return Array.from(new Set(missing))
}

export function recommendActions(
  tender: TenderBriefing,
  eligibility: EligibilityAssessment,
  missingDocuments: string[]
): RecommendedAction[] {
  const actions: RecommendedAction[] = []
  if (tender.briefingCompulsory) {
    actions.push({
      id: 'book-agent',
      priority: 'critical',
      title: 'Book an agent or attend compulsory briefing',
      rationale: 'Compulsory briefing attendance is a common disqualifier if missed.',
      dueDate: tender.briefingDate || null,
      blocking: true,
      sourceRequirement: 'compulsory briefing',
      completionStatus: 'open',
    })
  }
  for (const m of missingDocuments.slice(0, 5)) {
    actions.push({
      id: `fix-${m.slice(0, 24)}`,
      priority: 'high',
      title: `Resolve: ${m}`,
      rationale: 'Required for compliance readiness assessment.',
      blocking: true,
      completionStatus: 'open',
    })
  }
  if (eligibility.missingProfileFields.length) {
    actions.push({
      id: 'complete-profile',
      priority: 'medium',
      title: 'Complete SME compliance profile fields',
      rationale: `Missing: ${eligibility.missingProfileFields.join(', ')}`,
      blocking: false,
      completionStatus: 'open',
    })
  }
  actions.push({
    id: 'review-docs',
    priority: 'medium',
    title: 'Review official tender documents',
    rationale: 'Machine-assisted analysis is incomplete without source document review.',
    blocking: false,
    completionStatus: 'open',
  })
  return actions
}

export function buildSummary(
  tender: TenderBriefing,
  eligibility: EligibilityAssessment,
  actions: RecommendedAction[]
): TenderIntelligenceSummary {
  const unavailable: string[] = []
  if (!tender.closingDate) unavailable.push('Closing date')
  if (typeof tender.briefingCompulsory !== 'boolean') {
    unavailable.push('Compulsory briefing confirmation')
  }

  return {
    whatIsProcured: tender.title || 'Title not available in source listing',
    whoMayQualify:
      eligibility.classification === 'insufficient_information'
        ? 'Cannot assess yet — complete your profile and review tender documents.'
        : `Current assessment: ${eligibility.classification.replace(/_/g, ' ')} (not a guarantee).`,
    keyDates: [
      tender.briefingDate ? `Briefing: ${tender.briefingDate}` : null,
      tender.closingDate ? `Closing: ${tender.closingDate}` : null,
    ].filter(Boolean) as string[],
    mandatoryHighlights: [
      ...(tender.briefingCompulsory ? ['Compulsory briefing indicated'] : []),
      ...eligibility.unmet.slice(0, 4),
    ],
    returnables: (tender.documents || []).map((d) => d.title || d.url || 'Document').slice(0, 8),
    majorRisks: eligibility.potentialDisqualifiers,
    immediateActions: actions.slice(0, 3).map((a) => a.title),
    verifiedFacts: [
      tender.buyer ? `Issuer/buyer: ${tender.buyer}` : null,
      tender.province ? `Province: ${tender.province}` : null,
      typeof tender.briefingCompulsory === 'boolean'
        ? `Compulsory briefing flag: ${tender.briefingCompulsory}`
        : null,
    ].filter(Boolean) as string[],
    inferredNotes: [
      'CSD and tax clearance treated as baseline public-procurement expectations unless source says otherwise.',
      'Opportunity Fit is a readiness heuristic — not award probability.',
    ],
    unavailable,
  }
}

export function buildProcurementIntelligence(
  tender: TenderBriefing,
  sme: SmeProfileInput,
  opts?: { stale?: boolean }
): ProcurementIntelligenceResult {
  const facts = extractStructuredFacts(tender)
  const eligibility = assessEligibility(tender, sme)
  const opportunityFit = computeOpportunityFit(tender, sme, eligibility)
  const checklist = buildChecklist(tender, eligibility)
  const missingDocuments = detectMissingDocuments(eligibility, checklist)
  const recommendedActions = recommendActions(tender, eligibility, missingDocuments)
  const summary = buildSummary(tender, eligibility, recommendedActions)

  const hasCore = Boolean(tender.title && (tender.closingDate || tender.briefingDate))
  return {
    schemaVersion: INTELLIGENCE_SCHEMA_VERSION,
    tenderId: tender.id,
    smeId: sme.uid || null,
    generatedAt: new Date().toISOString(),
    stale: Boolean(opts?.stale),
    machineAssisted: true,
    status: hasCore ? 'complete' : 'partial',
    facts,
    summary,
    eligibility,
    opportunityFit,
    checklist,
    missingDocuments,
    recommendedActions,
    extractionConfidence: hasCore ? 'medium' : 'low',
  }
}
