/**
 * Canonical Procurement Intelligence Phase 1 schema.
 * Decision support only — never fabricate verified eligibility certainty.
 */

export const INTELLIGENCE_SCHEMA_VERSION = 'pi-phase1-1.0.0'
export const SCORING_RULES_VERSION = 'opportunity-fit-1.0.0'

export type FactConfidence = 'high' | 'medium' | 'low' | 'unknown'
export type FactKind = 'verified' | 'inferred' | 'unavailable'

export interface EvidenceRef {
  sourceDocument?: string
  pageOrSection?: string
  excerpt?: string
  confidence: FactConfidence
}

export interface FactField<T = unknown> {
  value: T | null
  kind: FactKind
  evidence?: EvidenceRef
}

export type EligibilityClass =
  | 'likely_eligible'
  | 'potentially_eligible'
  | 'eligibility_uncertain'
  | 'likely_ineligible'
  | 'insufficient_information'

export type ChecklistGroup =
  | 'mandatory_eligibility'
  | 'company_compliance'
  | 'technical_capability'
  | 'experience_references'
  | 'pricing_commercial'
  | 'submission_forms'
  | 'briefing_site_visit'
  | 'final_submission'

export type ChecklistItemStatus =
  | 'required'
  | 'available'
  | 'missing'
  | 'expired'
  | 'needs_verification'
  | 'not_applicable'

export interface ChecklistItem {
  id: string
  group: ChecklistGroup
  label: string
  status: ChecklistItemStatus
  sourceReference?: string
  smeAction?: string
  required: boolean
}

export interface ScoreFactor {
  id: string
  label: string
  delta: number
  direction: 'up' | 'down' | 'neutral'
}

export interface OpportunityFitScore {
  score: number
  label: 'Opportunity Fit'
  rulesVersion: string
  factors: ScoreFactor[]
}

export interface EligibilityAssessment {
  classification: EligibilityClass
  matched: string[]
  unmet: string[]
  needsVerification: string[]
  missingProfileFields: string[]
  potentialDisqualifiers: string[]
  remediation: string[]
  definitiveEligible: false
}

export interface RecommendedAction {
  id: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  title: string
  rationale: string
  dueDate?: string | null
  blocking: boolean
  sourceRequirement?: string
  completionStatus: 'open' | 'done' | 'not_applicable'
}

export interface TenderIntelligenceSummary {
  whatIsProcured: string
  whoMayQualify: string
  keyDates: string[]
  mandatoryHighlights: string[]
  returnables: string[]
  majorRisks: string[]
  immediateActions: string[]
  verifiedFacts: string[]
  inferredNotes: string[]
  unavailable: string[]
}

export interface StructuredTenderFacts {
  tenderId: string
  sourceId?: string | null
  issuer?: FactField
  department?: FactField
  title?: FactField
  description?: FactField
  category?: FactField
  province?: FactField
  location?: FactField
  estimatedValue?: FactField<number | string>
  currency?: FactField
  publicationDate?: FactField
  briefingDate?: FactField
  clarificationDeadline?: FactField
  closingDate?: FactField
  closingTime?: FactField
  submissionMethod?: FactField
  compulsoryBriefing?: FactField<boolean>
  cidbRequired?: FactField
  bbbeeRequired?: FactField
  csdRequired?: FactField
  taxComplianceRequired?: FactField
  coidaRequired?: FactField
  localContent?: FactField
  mandatoryDocuments?: FactField<string[]>
  disqualifiers?: FactField<string[]>
  contactDetails?: FactField
  documentLinks?: FactField<string[]>
}

export interface ProcurementIntelligenceResult {
  schemaVersion: string
  tenderId: string
  smeId: string | null
  generatedAt: string
  stale: boolean
  machineAssisted: true
  status: 'complete' | 'partial' | 'failed' | 'disabled'
  errorCode?: string
  facts: StructuredTenderFacts
  summary: TenderIntelligenceSummary
  eligibility: EligibilityAssessment
  opportunityFit: OpportunityFitScore
  checklist: ChecklistItem[]
  missingDocuments: string[]
  recommendedActions: RecommendedAction[]
  extractionConfidence: FactConfidence
}

export interface SmeProfileInput {
  uid?: string
  province?: string
  categories?: string[]
  sectors?: string[]
  commodities?: string[]
  matchingKeywords?: string[]
  csdRegistered?: boolean
  cidbGrade?: string | number
  bbbeeLevel?: string | number
  taxClearanceValid?: boolean
  coidaCompliant?: boolean
  compliance?: Record<string, unknown>
}
