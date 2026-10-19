/**
 * Phase 19 — Match new compulsory briefings to historically PAID attendance requests.
 * Recommendation-only. Never sends email or creates payment links.
 */
const {
  BRIEFING_CLASSIFICATION,
  SME_CONNECT_STATUS,
} = require('../domain/ocdsDayReconciliation')
const { getStorage } = require('./storageAdapter')
const store = require('./smeConnectRecommendationStore')
const auditLogService = require('./auditLogService')

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3)
}

function jaccard(aTokens, bTokens) {
  const a = new Set(aTokens)
  const b = new Set(bTokens)
  if (!a.size || !b.size) return 0
  let inter = 0
  for (const t of a) if (b.has(t)) inter += 1
  return inter / (a.size + b.size - inter)
}

/**
 * Score similarity 0–1 with explainable reasons.
 */
function scoreTenderAgainstPaidRequest(tender, request) {
  const reasons = []
  let score = 0

  const deptT = String(tender.department || tender.buyer || '').toLowerCase()
  const deptR = String(request.department || '').toLowerCase()
  if (deptT && deptR && (deptT === deptR || deptT.includes(deptR) || deptR.includes(deptT))) {
    score += 0.22
    reasons.push('same procurement entity')
  }

  const provT = String(tender.province || '').toLowerCase()
  const provR = String(request.province || '').toLowerCase()
  if (provT && provR && provT === provR) {
    score += 0.12
    reasons.push('same province')
  }

  const titleTokens = tokenize(`${tender.title || ''} ${tender.description || ''}`)
  const priorTokens = tokenize(`${request.tenderTitle || ''} ${request.department || ''}`)
  const overlap = jaccard(titleTokens, priorTokens)
  if (overlap >= 0.12) {
    score += Math.min(0.45, overlap * 0.9)
    reasons.push(`scope/title keyword overlap (${overlap.toFixed(2)})`)
  }

  // Category / HVAC-style shared strong tokens
  const strong = ['hvac', 'electrical', 'civil', 'security', 'cleaning', 'catering', 'ict', 'software']
  for (const kw of strong) {
    const inNew = titleTokens.includes(kw)
    const inOld = priorTokens.includes(kw)
    if (inNew && inOld) {
      score += 0.12
      reasons.push(`shared work profile keyword: ${kw}`)
    }
  }

  if (tender.briefingClassification === BRIEFING_CLASSIFICATION.CONFIRMED_COMPULSORY) {
    score += 0.05
    reasons.push('confirmed compulsory briefing')
  } else if (tender.briefingClassification === BRIEFING_CLASSIFICATION.LIKELY_COMPULSORY) {
    score += 0.03
    reasons.push('likely compulsory briefing')
  }

  score = Math.max(0, Math.min(1, score))
  return { score, reasons }
}

async function matchTenderToPaidSmes(tender, { minScore = 0.45, maxCandidates = 10 } = {}) {
  const storage = getStorage()
  const requests = await storage.getAttendanceRequests({ limit: 3000 })
  const paid = (requests || []).filter((r) => String(r.paymentStatus || '').toLowerCase() === 'paid')

  const bySme = new Map()
  for (const req of paid) {
    const { score, reasons } = scoreTenderAgainstPaidRequest(tender, req)
    if (score < minScore) continue
    const smeKey = req.smeId || req.smeEmail || req.smeCompany || req.id
    const prev = bySme.get(smeKey)
    if (!prev || score > prev.similarity) {
      bySme.set(smeKey, {
        status: SME_CONNECT_STATUS.MATCH_CANDIDATES,
        tenderId: tender.id,
        tenderNumber: tender.tenderNumber,
        tenderTitle: tender.title,
        briefingDate: tender.briefingDate || null,
        briefingClassification: tender.briefingClassification || null,
        smeId: req.smeId || null,
        smeName: req.smeName || req.smeCompany || null,
        smeCompany: req.smeCompany || req.smeName || null,
        smeEmail: req.smeEmail || null,
        previousRequestId: req.id,
        previousTenderNumber: req.tenderNumber || null,
        previousTenderTitle: req.tenderTitle || null,
        previousDepartment: req.department || null,
        similarity: Number(score.toFixed(4)),
        reasons,
        customerNotified: false,
        outreachReady: false,
      })
    }
  }

  const candidates = [...bySme.values()]
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, maxCandidates)

  const saved = []
  for (const c of candidates) {
    saved.push(await store.upsertRecommendation(c))
  }

  await auditLogService.logEvent({
    type: 'sme_connect.matching',
    tenderId: tender.id,
    candidateCount: saved.length,
    customerNotified: false,
  })

  return { tenderId: tender.id, candidates: saved, paidScanned: paid.length }
}

async function runMatchingForClassified({ limit = 100, minScore = 0.45 } = {}) {
  const storage = getStorage()
  const all = await storage.getTenderBriefings({ limit: 4000 })
  const eligible = (all || []).filter(
    (t) =>
      t.briefingClassification === BRIEFING_CLASSIFICATION.CONFIRMED_COMPULSORY ||
      t.briefingClassification === BRIEFING_CLASSIFICATION.LIKELY_COMPULSORY
  )
  const results = []
  for (const tender of eligible.slice(0, limit)) {
    results.push(await matchTenderToPaidSmes(tender, { minScore }))
  }
  return {
    tendersScanned: eligible.length,
    tendersMatched: results.length,
    candidatesCreated: results.reduce((n, r) => n + (r.candidates?.length || 0), 0),
    results,
  }
}

async function approveRecommendation(id) {
  const existing = await store.getRecommendation(id)
  if (!existing) throw new Error('Recommendation not found')
  return store.upsertRecommendation({
    ...existing,
    status: SME_CONNECT_STATUS.HUMAN_APPROVED,
    approvedAt: new Date().toISOString(),
    // Ready for a later outreach phase — still no send
    outreachReady: true,
    nextStatusHint: SME_CONNECT_STATUS.READY_FOR_OUTREACH,
    customerNotified: false,
  })
}

async function rejectRecommendation(id, reason = null) {
  const existing = await store.getRecommendation(id)
  if (!existing) throw new Error('Recommendation not found')
  return store.upsertRecommendation({
    ...existing,
    status: SME_CONNECT_STATUS.REJECTED,
    rejectedAt: new Date().toISOString(),
    rejectionReason: reason,
    outreachReady: false,
    customerNotified: false,
  })
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
  tokenize,
  jaccard,
  scoreTenderAgainstPaidRequest,
  matchTenderToPaidSmes,
  runMatchingForClassified,
  approveRecommendation,
  rejectRecommendation,
  markReadyForOutreach,
  listRecommendations: store.listRecommendations,
}
