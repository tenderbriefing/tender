/**
 * Phase 20 — SME Connect matching against normalized historical PAID requests.
 * Outreach send is separate (smeConnectOutreachService). Matching never emails.
 */
const {
  BRIEFING_CLASSIFICATION,
  SME_CONNECT_STATUS,
} = require('../domain/ocdsDayReconciliation')
const { getStorage } = require('./storageAdapter')
const store = require('./smeConnectRecommendationStore')
const {
  tokenizeMeaningful,
  loadNormalizedPaidRequests,
  auditPaidRequests,
} = require('./smeConnectPaidRequestAdapter')
const auditLogService = require('./auditLogService')

const MATCH_BAND = Object.freeze({
  HIGH_CONFIDENCE: 'HIGH_CONFIDENCE',
  REVIEW: 'REVIEW',
  NO_OUTREACH: 'NO_OUTREACH',
})

const REASON = Object.freeze({
  SAME_ENTITY: 'SAME_ENTITY',
  SAME_CATEGORY: 'SAME_CATEGORY',
  SCOPE_OVERLAP: 'SCOPE_OVERLAP',
  SAME_LOCATION: 'SAME_LOCATION',
  KEYWORD_OVERLAP: 'KEYWORD_OVERLAP',
  SIMILAR_WORK_TYPE: 'SIMILAR_WORK_TYPE',
  REPEAT_PROCUREMENT: 'REPEAT_PROCUREMENT',
})

const WORK_TYPES = [
  'hvac',
  'electrical',
  'civil',
  'security',
  'cleaning',
  'catering',
  'ict',
  'software',
  'financial',
  'finance',
  'accounting',
  'audit',
  'construction',
  'engineering',
  'transport',
  'medical',
  'pharmaceutical',
  'legal',
  'consulting',
]

function jaccard(aTokens, bTokens) {
  const a = new Set(aTokens)
  const b = new Set(bTokens)
  if (!a.size || !b.size) return 0
  let inter = 0
  for (const t of a) if (b.has(t)) inter += 1
  return inter / (a.size + b.size - inter)
}

function classifyBand(score, thresholds = {}) {
  const high = Number(thresholds.high ?? 0.8)
  const review = Number(thresholds.review ?? 0.65)
  if (score >= high) return MATCH_BAND.HIGH_CONFIDENCE
  if (score >= review) return MATCH_BAND.REVIEW
  return MATCH_BAND.NO_OUTREACH
}

/**
 * Component-scored similarity with structured reason codes.
 * Generic stopwords alone never produce SCOPE/KEYWORD hits.
 */
function scoreTenderAgainstPaidRequest(tender, request) {
  const components = {
    entity: 0,
    location: 0,
    scope: 0,
    workType: 0,
    repeatProcurement: 0,
    classificationBoost: 0,
  }
  const reasons = []

  const deptT = String(tender.department || tender.buyer || '').toLowerCase()
  const deptR = String(request.department || '').toLowerCase()
  if (deptT && deptR && (deptT === deptR || deptT.includes(deptR) || deptR.includes(deptT))) {
    components.entity = 0.28
    reasons.push(REASON.SAME_ENTITY)
  }

  const provT = String(tender.province || '').toLowerCase()
  const provR = String(request.province || '').toLowerCase()
  if (provT && provR && provT === provR) {
    components.location = 0.1
    reasons.push(REASON.SAME_LOCATION)
  }

  const newTokens = tokenizeMeaningful(
    `${tender.title || ''} ${tender.description || ''} ${tender.category || ''}`
  )
  const priorTokens = tokenizeMeaningful(
    `${request.scopeText || ''} ${request.tenderTitle || ''} ${request.department || ''}`
  )
  const overlap = jaccard(newTokens, priorTokens)
  if (overlap >= 0.08) {
    components.scope = Math.min(0.42, overlap * 1.05)
    reasons.push(REASON.SCOPE_OVERLAP)
    if (overlap >= 0.15) reasons.push(REASON.KEYWORD_OVERLAP)
  }

  const sharedWork = WORK_TYPES.filter((kw) => newTokens.includes(kw) && priorTokens.includes(kw))
  if (sharedWork.length) {
    components.workType = Math.min(0.24, 0.1 + sharedWork.length * 0.06)
    reasons.push(REASON.SIMILAR_WORK_TYPE)
    reasons.push(REASON.SAME_CATEGORY)
  }

  const tnNew = String(tender.tenderNumber || '').trim().toLowerCase()
  const tnOld = String(request.tenderNumber || '').trim().toLowerCase()
  if (tnNew && tnOld && tnNew !== tnOld) {
    // Same buyer + similar numbering pattern → weak repeat signal
    const prefixNew = tnNew.replace(/[^a-z]/g, '').slice(0, 4)
    const prefixOld = tnOld.replace(/[^a-z]/g, '').slice(0, 4)
    if (prefixNew && prefixNew === prefixOld && components.entity > 0) {
      components.repeatProcurement = 0.08
      reasons.push(REASON.REPEAT_PROCUREMENT)
    }
  }

  if (tender.briefingClassification === BRIEFING_CLASSIFICATION.CONFIRMED_COMPULSORY) {
    components.classificationBoost = 0.04
  } else if (tender.briefingClassification === BRIEFING_CLASSIFICATION.LIKELY_COMPULSORY) {
    components.classificationBoost = 0.02
  }

  const score = Math.max(
    0,
    Math.min(
      1,
      components.entity +
        components.location +
        components.scope +
        components.workType +
        components.repeatProcurement +
        components.classificationBoost
    )
  )

  // Guard: province + classification alone must not reach REVIEW
  const substantive =
    components.entity > 0 ||
    components.scope > 0 ||
    components.workType > 0 ||
    components.repeatProcurement > 0
  const finalScore = substantive ? score : Math.min(score, 0.2)

  return {
    score: Number(finalScore.toFixed(4)),
    components,
    reasons: [...new Set(reasons)],
    band: classifyBand(finalScore),
  }
}

function candidateId(smeKey, tenderId) {
  return `sme-rec-${String(smeKey).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40)}-${String(tenderId || 't').slice(0, 40)}`
}

async function hasExistingOutreach(smeKey, tenderId) {
  const existing = await store.listRecommendations({ limit: 2000 })
  return (existing || []).some(
    (r) =>
      (r.tenderId === tenderId || r.canonicalTenderId === tenderId) &&
      (r.smeId === smeKey || r.smeEmail === smeKey || r.smeCompany === smeKey) &&
      ['HUMAN_APPROVED', 'READY_FOR_OUTREACH', 'SENT', 'QUEUED'].includes(String(r.status || ''))
  )
}

async function matchTenderToPaidSmes(tender, opts = {}) {
  const storage = getStorage()
  const includeTestSmes = opts.includeTestSmes === true
  const minScore = Number(opts.minScore ?? 0.65)
  const maxCandidates = Number(opts.maxCandidates || 20)
  const thresholds = opts.thresholds || {}

  const bundle = await loadNormalizedPaidRequests(storage, {
    includeTestSmes,
    limit: opts.requestLimit || 5000,
  })
  const paid = bundle.normalized.filter((r) =>
    includeTestSmes ? true : r.eligibleForMatching
  )

  const bySme = new Map()
  let weakRejected = 0
  let duplicatesPrevented = 0

  for (const req of paid) {
    const scored = scoreTenderAgainstPaidRequest(tender, req)
    scored.band = classifyBand(scored.score, thresholds)
    if (scored.band === MATCH_BAND.NO_OUTREACH || scored.score < minScore) {
      weakRejected += 1
      continue
    }
    const smeKey = req.smeId || req.smeEmail || req.smeCompany || req.id
    if (await hasExistingOutreach(smeKey, tender.id)) {
      duplicatesPrevented += 1
      continue
    }
    const prev = bySme.get(smeKey)
    if (!prev || scored.score > prev.similarityScore) {
      bySme.set(smeKey, {
        id: candidateId(smeKey, tender.id),
        status: SME_CONNECT_STATUS.MATCH_CANDIDATES,
        matchBand: scored.band,
        newTenderId: tender.id,
        canonicalTenderId: tender.id,
        tenderId: tender.id,
        newTenderNumber: tender.tenderNumber || null,
        tenderNumber: tender.tenderNumber || null,
        newTenderTitle: tender.title || null,
        tenderTitle: tender.title || null,
        newTenderEntity: tender.department || tender.buyer || null,
        newTenderDescription: tender.description || null,
        briefingDate: tender.briefingDate || null,
        briefingTime: tender.briefingTime || null,
        briefingVenue: tender.briefingVenue || null,
        briefingClassification: tender.briefingClassification || null,
        smeId: req.smeId,
        smeName: req.smeName,
        smeCompany: req.smeCompany,
        contactName: req.contactName,
        contactEmail: req.smeEmail,
        smeEmail: req.smeEmail,
        previousRequestId: req.id,
        previousTenderNumber: req.tenderNumber,
        previousTenderTitle: req.tenderTitle,
        previousEntity: req.department,
        previousDepartment: req.department,
        previousPaidAt: req.paidAt,
        similarityScore: scored.score,
        similarity: scored.score,
        components: scored.components,
        reasons: scored.reasons,
        customerNotified: false,
        outreachReady: false,
        outreachStatus: null,
      })
    }
  }

  const candidates = [...bySme.values()]
    .sort((a, b) => b.similarityScore - a.similarityScore)
    .slice(0, maxCandidates)

  const saved = []
  if (opts.persist !== false) {
    for (const c of candidates) {
      saved.push(await store.upsertRecommendation(c))
    }
  }

  await auditLogService.logEvent({
    type: 'sme_connect.matching',
    tenderId: tender.id,
    candidateCount: candidates.length,
    weakRejected,
    duplicatesPrevented,
    customerNotified: false,
  })

  return {
    tenderId: tender.id,
    candidates: opts.persist === false ? candidates : saved,
    paidScanned: paid.length,
    weakRejected,
    duplicatesPrevented,
  }
}

async function runMatchingForClassified(opts = {}) {
  const storage = getStorage()
  const all = await storage.getTenderBriefings({ limit: opts.tenderLimit || 5000 })
  const eligible = (all || []).filter(
    (t) =>
      t.briefingClassification === BRIEFING_CLASSIFICATION.CONFIRMED_COMPULSORY ||
      (opts.includeLikely && t.briefingClassification === BRIEFING_CLASSIFICATION.LIKELY_COMPULSORY)
  )
  const results = []
  let high = 0
  let review = 0
  let weak = 0
  let duplicatesPrevented = 0
  for (const tender of eligible.slice(0, opts.limit || 200)) {
    const out = await matchTenderToPaidSmes(tender, {
      ...opts,
      minScore: opts.minScore ?? 0.65,
    })
    results.push(out)
    duplicatesPrevented += out.duplicatesPrevented || 0
    weak += out.weakRejected || 0
    for (const c of out.candidates || []) {
      if (c.matchBand === MATCH_BAND.HIGH_CONFIDENCE) high += 1
      else if (c.matchBand === MATCH_BAND.REVIEW) review += 1
    }
  }
  return {
    tendersScanned: Math.min(eligible.length, opts.limit || 200),
    tendersAvailable: eligible.length,
    tendersMatched: results.filter((r) => (r.candidates || []).length > 0).length,
    candidatesCreated: results.reduce((n, r) => n + (r.candidates?.length || 0), 0),
    highConfidence: high,
    review,
    weakRejected: weak,
    duplicatesPrevented,
    results,
  }
}

async function auditHistoricalPaid() {
  const storage = getStorage()
  const bundle = await loadNormalizedPaidRequests(storage, {
    includeTestSmes: true,
    limit: 5000,
  })
  const withSynthetic = auditPaidRequests(bundle)
  const liveOnly = await loadNormalizedPaidRequests(storage, {
    includeTestSmes: false,
    limit: 5000,
  })
  return {
    ...withSynthetic,
    eligibleLiveMatching: liveOnly.normalized.filter((r) => r.eligibleForMatching).length,
  }
}

async function approveRecommendation(id) {
  const existing = await store.getRecommendation(id)
  if (!existing) throw new Error('Recommendation not found')
  return store.upsertRecommendation({
    ...existing,
    status: SME_CONNECT_STATUS.HUMAN_APPROVED,
    approvedAt: new Date().toISOString(),
    outreachReady: true,
    nextStatusHint: SME_CONNECT_STATUS.READY_FOR_OUTREACH,
    customerNotified: false,
  })
}

async function rejectRecommendation(id, reason = null, asBadMatch = false) {
  const existing = await store.getRecommendation(id)
  if (!existing) throw new Error('Recommendation not found')
  return store.upsertRecommendation({
    ...existing,
    status: SME_CONNECT_STATUS.REJECTED,
    rejectedAt: new Date().toISOString(),
    rejectionReason: reason,
    badMatch: asBadMatch === true,
    outreachReady: false,
    customerNotified: false,
  })
}

async function dismissBadMatch(id, reason = null) {
  return rejectRecommendation(id, reason || 'bad_match', true)
}

async function markReadyForOutreach(id) {
  const existing = await store.getRecommendation(id)
  if (!existing) throw new Error('Recommendation not found')
  if (existing.status !== SME_CONNECT_STATUS.HUMAN_APPROVED) {
    throw new Error('Must be HUMAN_APPROVED before READY_FOR_OUTREACH')
  }
  return store.upsertRecommendation({
    ...existing,
    status: SME_CONNECT_STATUS.READY_FOR_OUTREACH,
    customerNotified: false,
  })
}

module.exports = {
  MATCH_BAND,
  REASON,
  WORK_TYPES,
  tokenize: tokenizeMeaningful,
  jaccard,
  classifyBand,
  scoreTenderAgainstPaidRequest,
  matchTenderToPaidSmes,
  runMatchingForClassified,
  auditHistoricalPaid,
  approveRecommendation,
  rejectRecommendation,
  dismissBadMatch,
  markReadyForOutreach,
  listRecommendations: store.listRecommendations,
  getRecommendation: store.getRecommendation,
}
