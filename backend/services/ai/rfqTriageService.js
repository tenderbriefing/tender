/**
 * Autonomous RFQ triage — classify, urgency, readiness, duplicates.
 */
const { persistInsight, nowIso, clamp } = require('./_shared')
const COLLECTIONS = require('./autonomousCollections')

const OUTCOMES = [
  'dispatch_ready',
  'sme_review_required',
  'missing_information',
  'low_value_opportunity',
  'duplicate_opportunity',
]

function classifyRfq(extraction = {}, duplicateRisk = null) {
  const readiness = extraction.readiness || {}
  const missing = readiness.missingFields || []
  const confidence = readiness.confidence ?? extraction.confidence ?? 0.5

  if (duplicateRisk?.duplicate) {
    return {
      outcome: 'duplicate_opportunity',
      classification: 'duplicate',
      urgency: readiness.urgency || 'normal',
      opportunityQuality: 0.2,
      dispatchReadiness: 'blocked',
      recommendedActions: ['Review duplicate tender before converting'],
    }
  }

  if (readiness.dispatchEligible && confidence >= 0.55) {
    return {
      outcome: 'dispatch_ready',
      classification: extraction.compulsoryBriefing ? 'compulsory_briefing' : 'standard_rfq',
      urgency: readiness.urgency || 'normal',
      opportunityQuality: clamp(confidence + (extraction.briefingDetected ? 0.15 : 0), 0, 1),
      dispatchReadiness: 'ready',
      recommendedActions: ['Approve and convert', 'Request youth agent after conversion'],
    }
  }

  if (missing.length > 3 || confidence < 0.4) {
    return {
      outcome: 'missing_information',
      classification: 'incomplete',
      urgency: 'low',
      opportunityQuality: clamp(confidence * 0.6, 0, 0.5),
      dispatchReadiness: 'incomplete',
      recommendedActions: readiness.smeActionChecklist || ['Complete missing RFQ fields'],
    }
  }

  if (!extraction.briefingDetected && !extraction.compulsoryBriefing && !extraction.closingDate) {
    return {
      outcome: 'low_value_opportunity',
      classification: 'low_signal',
      urgency: 'low',
      opportunityQuality: 0.25,
      dispatchReadiness: 'review',
      recommendedActions: ['Confirm this is a live procurement opportunity'],
    }
  }

  return {
    outcome: 'sme_review_required',
    classification: extraction.category || 'general',
    urgency: readiness.urgency || 'normal',
    opportunityQuality: clamp(confidence, 0.3, 0.85),
    dispatchReadiness: readiness.dispatchReadiness || 'review',
    recommendedActions: readiness.smeActionChecklist || ['SME review required before dispatch'],
  }
}

async function triageIngestedEmail(emailDoc) {
  const extraction = emailDoc.extraction || {}
  const triage = classifyRfq(extraction, emailDoc.duplicateRisk)
  const payload = {
    emailId: emailDoc.id,
    forwardedByUid: emailDoc.forwardedByUid || null,
    subject: emailDoc.subject || '',
    ...triage,
    briefingDetected: Boolean(extraction.briefingDetected || extraction.compulsoryBriefing),
    documentsExtracted: (extraction.attachmentResults || []).length,
    extractionConfidence: extraction.readiness?.confidence ?? extraction.confidence ?? 0.5,
    triagedAt: nowIso(),
    aiProvider: extraction.extractionMethod === 'openai' ? 'openai' : 'rule-based',
  }
  await persistInsight(COLLECTIONS.RFQ_TRIAGE_RESULTS, String(emailDoc.id), payload)
  return payload
}

module.exports = { classifyRfq, triageIngestedEmail, OUTCOMES, COLLECTION: COLLECTIONS.RFQ_TRIAGE_RESULTS }
